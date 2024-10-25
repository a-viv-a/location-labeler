import { formatLabel, labelIsSigned, SignedLabel, signLabel, UnsignedLabel } from "@skyware/labeler";
import {
  ComAtprotoLabelDefs,
} from "@atcute/client/lexicons";
import { frameToBytes, iter_prepared, nulled, sleep } from "./util";
import { declareLabeler } from "@skyware/labeler/scripts";
import { LabelDefinition, SequencedLabel } from "./types";


// dynamic labels

export const ensureLabelExists = async (env: Env, definition: LabelDefinition) => {
  if (await defineLabel(env.DB, definition)) {
    const defns = await readLabelDefinitions(env.DB)
    await declareLabeler({
      identifier: env.IDENTIFIER,
      password: env.PASSWORD
    }, defns, true)
  }
}

const defineLabel = async (DB: Env['DB'], definition: LabelDefinition) => {
  const stmt = DB.prepare(`
    INSERT INTO label_definitions (identifier, en_locale_name, en_locale_desc)
    VALUES (?, ?, ?)
  `)

  const { identifier, en_locale_name, en_locale_desc } = definition
  try {
    const result_identifier = await stmt.bind(identifier, en_locale_name, en_locale_desc).first('identifier')
  } catch (e: any) {
    if (typeof e?.message === 'string' && e?.message.includes('SQLITE_CONSTRAINT')) {
      return false
    }
    throw e
  }
  console.log("inserted", definition)
  return true
}

const readLabelDefinitions = async (DB: Env['DB']): Promise<ComAtprotoLabelDefs.LabelValueDefinition[]> => {
  const stmt = DB.prepare(`
      SELECT * from label_definitions
    `)

  const queryResult = await stmt.all<LabelDefinition>()

  if (!queryResult.success) {
    throw new Error('query failed!')
  }

  return queryResult.results.map(d => ({
    blurs: 'none',
    severity: 'inform', // TODO: review
    identifier: d.identifier,
    locales: buildLocales(d)
  }))
}

const buildLocales = (label: LabelDefinition): ComAtprotoLabelDefs.LabelValueDefinitionStrings[] => [
  {
    lang: 'en',
    name: label.en_locale_name,
    description: label.en_locale_desc
  }]


// label publishing

export const sendLabels = async (
  cursor: number,
  env: Env,
  announceLabel: (label: SequencedLabel) => void,
  onError: (error: string, message: string) => void
) => {
  if (Number.isNaN(cursor)) {
    // TODO: is this legal?
    onError('NaNCursor', "Cursor is NaN")
    return
  }

  const latest_id = await env.DB.prepare(`
			SELECT MAX(id) AS id FROM labels
		`).first<number>("id")

  if (cursor > (latest_id ?? 0)) {
    onError("FutureCursor", "Cursor is in the future")
    return
  }

  const stmt = env.DB.prepare(`
			SELECT * FROM labels
  			WHERE id > ?
  			ORDER BY id ASC
  			LIMIT ?
		`);

  try {
    for await (const [seq, label] of iter_prepared<SignedLabel>(
      ({ i: id, batch }) => stmt.bind(id, batch),
      cursor,
      10
    )) {
      const sequencedLabel = { seq, label }
      announceLabel(sequencedLabel)
    }
  } catch (e) {
    console.error(e);
    onError(
      "InternalServerError",
      "An unknown error occurred",
    );
    await sleep(500);
    throw e;
  }

}


const buildRecordStmt = (DB: Env['DB'], signed: SignedLabel): ReturnType<Env['DB']['prepare']> => {
  const { src, uri, cid, val, neg, cts, exp, sig } = signed;
  return DB.prepare(`
		INSERT INTO labels (src, uri, cid, val, neg, cts, exp, sig)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`).bind(...nulled(src, uri, cid, val, neg, cts, exp, sig));
}

export const signAndRecordLabel = async (env: Env, label: UnsignedLabel): Promise<SignedLabel[]> => {
  // const signed = labelIsSigned(label) ? label : signLabel(label, env.LABEL_SIGNING_KEY as any);

  if (labelIsSigned(label)) {
    throw new Error("label should not be signed")
  }

  if (label.neg) {
    throw new Error("Negation isn't supported by queries yet. Labels are automatically negated")
  }

  // get active labels on this uri
  // this is summoning a TOCTOU bug but I don't see a way around this
  // we can't sign labels inside a query...
  // TODO: explore locking?
  const active_labels = await env.DB.prepare(`
    WITH active_labels AS (
      SELECT src, uri, cid, val, neg, MAX(cts) as cts, exp, sig FROM labels
        WHERE uri=?
        GROUP BY val
    )

    SELECT src, uri, cid, val, neg, cts, exp FROM active_labels
      WHERE (
        neg IS NULL
        OR neg = false
      )
    `).bind(label.uri).all<UnsignedLabel>()
  if (!active_labels.success) {
    throw new Error("failed to find active labels")
  }

  if (active_labels.results.find(l => l.val === label.val) != undefined) {
    console.log(active_labels.results)
    console.log("label already applied!")
    return []
  }

  const new_labels = [
    ...active_labels.results
      .map(l => ({
        ...l,
        // negate the active labels
        neg: true,
        // set a new time
        cts: new Date().toISOString()
      })),
    label
  ].map(l =>
    // the reason we can't do this all in one transaction is because we need to sign the dependent labels
    // @ts-expect-error type for this fn is wrong in cf worker environment, it is string!
    signLabel(l, env.LABEL_SIGNING_KEY)
  )

  const written = await env.DB.batch<SignedLabel>(new_labels.map(l => buildRecordStmt(env.DB, l)))
  for (const write of written) {
    console.log(write)
  }
  if (written == null || !written.reduce((success, write) => success && write.success, true)) {
    throw new Error("Failed to insert label");
  }

  return new_labels;
}

export const prepareLabel = ({ src, target, date, neg }: { src: string, target: string, date?: Date, neg?: true }, labelDefinition: LabelDefinition): UnsignedLabel => (
  {
    val: labelDefinition.identifier,
    src: `did:${src}`,
    uri: `did:${target}`,
    neg,
    // cid: undefined,
    cts: (date ?? new Date()).toISOString()
  }
)

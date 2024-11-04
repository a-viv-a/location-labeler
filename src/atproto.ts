import { formatLabel, SavedLabel, SignedLabel, signLabel, UnsignedLabel } from "@skyware/labeler";
import {
  ComAtprotoLabelDefs,
} from "@atcute/client/lexicons";
import { frameToBytes, iter_prepared, labelIsSigned, nulled, sleep } from "./util";
import { declareLabeler } from "@skyware/labeler/scripts";
import { LabelDefinition, TemplateLabel } from "./types";


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
  announceLabel: (label: SavedLabel) => void,
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

  console.log({ latest_id })

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
    for await (const [_id, label] of iter_prepared<SavedLabel>(
      ({ i: id, batch }) => stmt.bind(id, batch),
      cursor,
      10
    )) {
      announceLabel(label)
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
		RETURNING *
	`).bind(...nulled(src, uri, cid, val, neg, cts, exp, sig));
}

// TODO: reduce duplication
export const negateAndRecordAllActiveLabels = async (env: Env, uri: string): Promise<SavedLabel[]> => {
  const active_labels = await env.DB.prepare(`
    WITH active_labels AS (
      SELECT src, uri, cid, val, neg, MAX(cts) as cts, exp, sig FROM labels
        WHERE uri=?
        GROUP BY val
    )

    SELECT src, uri, cid, val, neg, exp FROM active_labels
      WHERE (
        neg IS NULL
        OR neg = false
      )
    `).bind(uri).all<TemplateLabel>()
  if (!active_labels.success) {
    throw new Error("failed to find active labels")
  }
  let negation_cts = new Date().toISOString()
  const new_labels = active_labels.results
    .map(l => ({
      ...l,
      // negate the active labels
      neg: true,
      // set a new time
      cts: negation_cts
    })).map(l =>
      // the reason we can't do this all in one transaction is because we need to sign the dependent labels
      signLabel(l,
        // TODO: investigate
        // @ts-expect-error type for this fn seems to be wrong in the cf worker environment
        env.LABEL_SIGNING_KEY)
    )

  const written = await env.DB.batch<SavedLabel>(new_labels.map(l => buildRecordStmt(env.DB, l)))

  if (written == null || !written.reduce((success, write) => success && write.success, true)) {
    throw new Error("Failed to insert label");
  }

  const flatWrites = written.flatMap(write => write.results);
  console.log("flatWrites", flatWrites)
  return flatWrites
}

export const signAndRecordLabelNegatingPrevious = async (env: Env, label: TemplateLabel): Promise<SavedLabel[]> => {
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

    SELECT src, uri, cid, val, neg, exp FROM active_labels
      WHERE (
        neg IS NULL
        OR neg = false
      )
    `).bind(label.uri).all<TemplateLabel>()
  if (!active_labels.success) {
    throw new Error("failed to find active labels")
  }

  if (active_labels.results.find(l => l.val === label.val) != undefined) {
    console.log("label already applied!", active_labels.results)
    return []
  }
  let negation_cts = new Date().toISOString()
  const new_labels = [
    ...active_labels.results
      .map(l => ({
        ...l,
        // negate the active labels
        neg: true,
        // set a new time
        cts: negation_cts
      })),
    { ...label, cts: new Date().toISOString() }
  ].map(l =>
    // the reason we can't do this all in one transaction is because we need to sign the dependent labels
    signLabel(l,
      // TODO: investigate
      // @ts-expect-error type for this fn seems to be wrong in the cf worker environment
      env.LABEL_SIGNING_KEY)
  )

  const written = await env.DB.batch<SavedLabel>(new_labels.map(l => buildRecordStmt(env.DB, l)))

  if (written == null || !written.reduce((success, write) => success && write.success, true)) {
    throw new Error("Failed to insert label");
  }

  const flatWrites = written.flatMap(write => write.results);
  console.log("flatWrites", flatWrites)
  return flatWrites
}

const isDidString = (s: string): s is `did:${string}` => {
  return s.startsWith('did:')
}

export const prepareLabel = ({ src, target, neg }: { src: string, target: string, neg?: true }, labelDefinition: LabelDefinition): TemplateLabel => {
  if (!(isDidString(src) && isDidString(target))) {
    throw new Error(`src/target must have the "did:" prepended!`)
  }
  return {
    val: labelDefinition.identifier,
    src,
    uri: target,
    neg,
    // cid: undefined,
  }
}

import { labelIsSigned, SignedLabel, signLabel, UnsignedLabel } from "@skyware/labeler";
import {
  ComAtprotoLabelDefs,
} from "@atcute/client/lexicons";
import { nulled } from "./util";
import { declareLabeler } from "@skyware/labeler/scripts";
import { LabelDefinition } from "./types";


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

// export const sendLabels = async (cursor: number, env: Env, ws: WebSocket) => {
//   if (!Number.isNaN(cursor)) {
//     const latest = await env.DB.prepare(`
// 				SELECT MAX(id) AS id FROM labels
// 			`).run() as any as { id: number };
//     if (cursor > (latest.id ?? 0)) {
//       const errorBytes = frameToBytes("error", {
//         error: "FutureCursor",
//         message: "Cursor is in the future",
//       });
//       ws.send(errorBytes);
//       ws.terminate();
//     }
//     const stmt = env.DB.prepare<[number]>(`
// 				SELECT * FROM labels
// 				WHERE id > ?
// 				ORDER BY id ASC
// 			`);

//     try {
//       for (const row of stmt.iterate(cursor)) {
//         const { id: seq, ...label } = row as SavedLabel;
//         const bytes = frameToBytes(
//           "message",
//           { seq, labels: [formatLabel(label)] },
//           "#labels",
//         );
//         ws.send(bytes);
//       }
//     } catch (e) {
//       console.error(e);
//       const errorBytes = frameToBytes("error", {
//         error: "InternalServerError",
//         message: "An unknown error occurred",
//       });
//       ws.send(errorBytes);
//       ws.terminate();
//     }
//   }
// }


export const signAndRecordLabel = async (env: Env, label: UnsignedLabel): Promise<SignedLabel[]> => {
  const signed = labelIsSigned(label) ? label : signLabel(label, env.LABEL_SIGNING_KEY as any);

  const { src, uri, cid, val, neg, cts, exp, sig } = signed;

  if (neg) {
    throw new Error("Negation isn't supported by queries yet. Labels are automatically negated")
  }

  // get any active labels on this uri and insert negations for them
  // this is only safe inside a transaction!!
  const negateOldLabelsStmt = env.DB.prepare(`
    WITH old_labels AS (
      DELETE FROM labels
        WHERE uri=?
        AND (neg IS NULL OR neg = false)
      RETURNING *
    )

    INSERT INTO labels (src, uri, cid, val, neg, cts, exp, sig)
      SELECT src, uri, cid, val, true, cts, exp, sig
      FROM old_labels
      RETURNING *;
    `).bind(uri)

  // drop a negation for this val (identifier) if it exists
  const dropNegationStmt = env.DB.prepare(`
      DELETE FROM labels
        WHERE uri=?
        AND vaw=?
        AND neg = true
    `).bind(uri, val)
  
  const insertStmt = env.DB.prepare(`
		INSERT INTO labels (src, uri, cid, val, neg, cts, exp, sig)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		RETURNING src, uri, cid, val, neg, cts, exp, sig
	`).bind(...nulled(src, uri, cid, val, neg, cts, exp, sig));

  const written = await env.DB.batch<SignedLabel>([
    negateOldLabelsStmt,
    dropNegationStmt,
    insertStmt
  ])
  console.log({ written })
  if (written == null) throw new Error("Failed to insert label");

  return written.flatMap(s => s.results);
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

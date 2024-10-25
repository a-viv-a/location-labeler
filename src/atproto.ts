import { labelIsSigned, signLabel, UnsignedLabel } from "@skyware/labeler";
import {
  ComAtprotoLabelDefs,
} from "@atcute/client/lexicons";
import { nulled } from "./util";
import { declareLabeler } from "@skyware/labeler/scripts";

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

export type LabelDefinition = { identifier: string, en_locale_name: string, en_locale_desc: string }
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
    locales: [{
      lang: 'EN',
      name: d.en_locale_name,
      description: d.en_locale_desc
    }]
  }))
}

export const ensureLabelExists = async (env: Env, definition: LabelDefinition) => {
  if (await defineLabel(env.DB, definition)) {
    const defns = await readLabelDefinitions(env.DB)
    await declareLabeler({
      identifier: env.IDENTIFIER,
      password: env.PASSWORD
    }, defns, true)
  }
}

export const recordLabel = async (env: Env, label: UnsignedLabel) => {
  const signed = labelIsSigned(label) ? label : signLabel(label, env.LABEL_SIGNING_KEY as any);

  const stmt = env.DB.prepare(`
		INSERT INTO labels (src, uri, cid, val, neg, cts, exp, sig)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`);

  const { src, uri, cid, val, neg, cts, exp, sig } = signed;
  const result = await stmt.bind(...nulled(src, uri, cid, val, neg ? 1 : 0, cts, exp, sig)).first<UnsignedLabel & {id:number}>()
  console.log({ result })
  if (result == null) throw new Error("Failed to insert label");

  return { id: result.id, ...signed };
}

export const createLabel = (src_did: string, label: { val: string, uri: string, cid?: string, neg?: true }, date?: Date): UnsignedLabel => (
  {
    ...label,
    src: `did:${src_did}`,
    cts: (date ?? new Date()).toISOString()
  }
)

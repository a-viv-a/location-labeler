import { labelIsSigned,  signLabel,  UnsignedLabel } from "@skyware/labeler";
import { nulled } from "./util";

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


export const recordLabel = async (env: Env, label: UnsignedLabel) => {
  const signed = labelIsSigned(label) ? label : signLabel(label, env.LABEL_SIGNING_KEY as any);

  const stmt = env.DB.prepare(`
		INSERT INTO labels (src, uri, cid, val, neg, cts, exp, sig)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`);

  const { src, uri, cid, val, neg, cts, exp, sig } = signed;
  // const result = stmt.run(src, uri, cid, val, neg ? 1 : 0, cts, exp, sig);
  const result = await stmt.bind(...nulled(src, uri, cid, val, neg ? 1 : 0, cts, exp, sig)).first()
  console.log({ result })
  if (result == null || !result.changes) throw new Error("Failed to insert label");

  const id = Number(result.lastInsertRowid);

  return { id, ...signed };
}

export const createLabel = (src_did: string, label: { val: string, uri: string, cid?: string, neg?: true }, date?: Date): UnsignedLabel => (
  {
    ...label,
    src: `did:${src_did}`,
    cts: (date ?? new Date()).toISOString()
  }
)

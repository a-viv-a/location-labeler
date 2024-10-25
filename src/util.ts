import { encode as cborEncode } from "@atcute/cbor";
import { concat as ui8Concat } from "uint8arrays";

type Nulled<T> = {
  [K in keyof T]: T[K] extends undefined ? null : T[K]
}

export const nulled = <T extends unknown[]>(...args: T): Nulled<T> =>
  args.map(v => v ?? null) as Nulled<T>

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
A template string where undefined or null is forbidden, and will give an error that shows the template
*/
export function defined(strings: TemplateStringsArray, ...values: unknown[]) {
  let result = '';
  for (let i = 0; i < values.length; i++) {
    if (values[i] === undefined || values[i] === null) {
      const template = strings.join('${}')
      throw new Error(`Interpolation value ${i} is ${values[i]} in \`${template}\` = \`${result}${strings[i]}\${${i}: ${values[i]}}${i + 1 === values.length ? '' : '...'}\``);
    }
    result += `${strings[i]}${values[i]}`;
  }
  result += strings[strings.length - 1];
  return result;
}

/**
Iterate via a prepared statement.
*/
export async function* iter_prepared<Y = never>(bind: (_: { i: number, batch: number }) => D1PreparedStatement, initial: number, batch: number) {
  const results: Y[] = []

  let consumed = false
  for (let i = initial; ; i++) {
    const result = results.pop()
    if (result != undefined) {
      yield [i, result] as const
      continue
    }

    if (consumed) { break }

    if (results
      .push(
        ...(await bind({ i, batch }).all<Y>()).results
      ) < batch) {
      consumed = true
    }
  }
}

// https://github.com/skyware-js/labeler/blob/75410cf52c86b7f5ad471f0f7941e5c11a2ec14d/src/util/util.ts#L16-L21
export function frameToBytes(type: "error", body: unknown): Uint8Array;
export function frameToBytes(type: "message", body: unknown, t: string): Uint8Array;
export function frameToBytes(type: "error" | "message", body: unknown, t?: string): Uint8Array {
  const header = type === "error" ? { op: -1 } : { op: 1, t };
  return ui8Concat([cborEncode(header), cborEncode(body)]);
}

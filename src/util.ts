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

type Nulled<T> = {
  [K in keyof T]: T[K] extends undefined ? null : T[K]
}

export const nulled = <T extends unknown[]>(...args: T): Nulled<T> =>
  args.map(v => v ?? null) as Nulled<T>


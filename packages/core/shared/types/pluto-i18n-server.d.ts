// This file has no import or export on purpose: that keeps `declare module` an ambient declaration.
declare module '#pluto-i18n-server' {
  export const localeCodes: string[]
  export const defaultLocale: string
  export const messageLoaders: Record<
    string,
    () => Promise<Record<string, unknown>>
  >
}

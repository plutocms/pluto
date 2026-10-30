// The Nitro virtual module that the pluto-i18n module generates. It gives the
// server translator (`server/utils/pluto-i18n.ts`) the locale files of every
// layer. This file has no import or export on purpose: that keeps the
// `declare module` an ambient declaration.
declare module '#pluto-i18n-server' {
  export const localeCodes: string[]
  export const defaultLocale: string
  export const messageLoaders: Record<
    string,
    () => Promise<Record<string, unknown>>
  >
}

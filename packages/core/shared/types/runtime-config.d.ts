import type { PlutoMailConfig } from './mail'

// Adds the private `plutoMail` block to Nuxt's `RuntimeConfig`. Set it with
// `NUXT_PLUTO_MAIL_*` variables at run time. See the mail skill.
declare module '@nuxt/schema' {
  interface RuntimeConfig {
    plutoMail: PlutoMailConfig
  }
}

export {}

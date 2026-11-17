import type { PlutoFormDefinition, PlutoFormFieldTypeInput } from './forms'

declare module '@nuxt/schema' {
  interface AppConfigInput {
    plutoForms?: {
      /** The forms defined in code (`definePlutoForm`). The lists of the app and its layers join. */
      forms?: PlutoFormDefinition[]
      /** The custom field types (`definePlutoFormField`). */
      fieldTypes?: PlutoFormFieldTypeInput[]
    }
  }

  interface PublicRuntimeConfig {
    plutoForms: {
      enabled: boolean
    }
  }
}

export {}

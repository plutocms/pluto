import type { PlutoTranslateFn } from '../../../shared/types/i18n'
export interface PlutoEmailContext {
  t: PlutoTranslateFn
  locale: string
  siteName: string
}

export interface PlutoEmailContent {
  subject: string
  html: string
  text: string
}

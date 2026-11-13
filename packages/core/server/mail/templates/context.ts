export interface PlutoEmailContext {
  t: (key: string, params?: Record<string, unknown>) => string
  locale: string
  siteName: string
}

export interface PlutoEmailContent {
  subject: string
  html: string
  text: string
}

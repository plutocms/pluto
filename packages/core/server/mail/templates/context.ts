/** What every email template gets: a translator bound to the email language, and the site name. */
export interface PlutoEmailContext {
  t: (key: string, params?: Record<string, unknown>) => string
  /** The language code of the email. */
  locale: string
  siteName: string
}

/** A rendered email. */
export interface PlutoEmailContent {
  subject: string
  html: string
  text: string
}

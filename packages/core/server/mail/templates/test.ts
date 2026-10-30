import type { PlutoEmailContent, PlutoEmailContext } from './context'
import { renderEmailLayout, toSubject } from '../layout'

/** The test email. The Email settings page sends it to check the setup. */
export function renderTestEmail(context: PlutoEmailContext): PlutoEmailContent {
  const { t, siteName } = context
  const params = { siteName }

  return {
    subject: toSubject(t('pluto.mail.test.subject', params)),
    ...renderEmailLayout({
      lang: context.locale,
      siteName,
      heading: t('pluto.mail.test.heading', params),
      paragraphs: [
        t('pluto.mail.test.body', params),
        t('pluto.mail.test.hint', params),
      ],
      footer: t('pluto.mail.footer', params),
    }),
  }
}

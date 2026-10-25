import type { PlutoEmailContent, PlutoEmailContext } from './context'
import { renderEmailLayout, toSubject } from '../layout'

export interface PlutoInviteEmailData {
  /** The link that accepts the invitation. An http(s) URL. */
  url: string
  /** The name of the person who invited, when known. */
  inviterName?: string
  /** The names of the roles the person gets. */
  roles?: string[]
}

/** The invitation to manage the site. */
export function renderInviteEmail(context: PlutoEmailContext, data: PlutoInviteEmailData): PlutoEmailContent {
  const { t, siteName } = context
  const params = { siteName }
  const inviter = data.inviterName?.trim()
  const roles = (data.roles ?? []).map((role) => role.trim()).filter(Boolean)

  const paragraphs = [
    inviter
      ? t('pluto.mail.invite.introBy', { siteName, inviter })
      : t('pluto.mail.invite.intro', params),
  ]
  if (roles.length > 0) {
    paragraphs.push(t('pluto.mail.invite.roles', { roles: roles.join(', ') }))
  }

  return {
    subject: toSubject(t('pluto.mail.invite.subject', params)),
    ...renderEmailLayout({
      lang: context.locale,
      siteName,
      heading: t('pluto.mail.invite.heading', params),
      paragraphs,
      button: { label: t('pluto.mail.invite.button'), url: data.url },
      linkHint: t('pluto.mail.linkHint'),
      notes: [t('pluto.mail.invite.ignore')],
      footer: t('pluto.mail.footer', params),
    }),
  }
}

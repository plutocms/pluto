# Mail

Pluto sends its own emails through a mail driver. The first emails are the test email and the
invitation. Resend is the first real driver. The driver is a contract, so a site can move from
one provider to another with no change to the rest of the site.

Core ships the contract, three drivers, two email templates, a server translator, and a guided
setup page at `Settings > Email`. A backend layer sends its emails with `sendPlutoMail`.

## Files

- `shared/types/mail.ts` — `PlutoMailMessage`, `PlutoMailDriver`, `PlutoMailStore`,
  `PlutoMailStatus`, `PlutoMailConfig`, `PlutoMailErrorCode`, and the domain types.
- `shared/types/runtime-config.d.ts` — adds `plutoMail` to `RuntimeConfig`.
- `shared/utils/mail.ts` — pure helpers that the page and the routes share: `isPlutoMailAddress`,
  `isPlutoMailDomain`, `plutoMailEnvLine`, `plutoMailDomainState`, `plutoMailPollDelay`,
  `createPlutoMailPoller`, `plutoMailErrorCode`, `PLUTO_MAIL_REGIONS`.
- `server/utils/pluto-mail.ts` — `registerMailDriver`, `registerMailStore`, `resolveMailDriver`,
  `getPlutoMailStatus`, `sendPlutoMail`, `renderPlutoEmail`, and `PlutoMailError`.
- `server/utils/pluto-i18n.ts` — `usePlutoServerTranslator(locale)`.
- `server/utils/pluto-mail-admin.ts` — the admin guard (`requireMailAdmin`), the error mapping,
  and the test-email rate limit.
- `server/mail/errors.ts` — the `PlutoMailError` class.
- `server/mail/resend-client.ts` — a small Resend API client over `fetch` (no SDK).
- `server/mail/drivers/{resend,dev,none}.ts` — the three drivers.
- `server/mail/layout.ts`, `server/mail/templates/{test,invite,context}.ts` — the email layout and
  templates.
- `server/mail/handlers.ts` — the logic of the admin routes.
- `server/api/_pluto/mail/**` — the admin routes (thin files that call `handlers.ts`).
- `app/composables/pluto-mail.ts` — `usePlutoMail()` and `usePlutoMailPanels()`.
- `app/pages/admin/settings/email.vue` and `app/components/Pluto/Mail/*` — the setup page.
- `modules/pluto-i18n` — also makes the Nitro virtual module `#pluto-i18n-server`.
- Tests: `test/mail-*.test.ts`, `test/pluto-mail.test.ts`, `test/pluto-server-i18n.test.ts`.

## Configuration

All settings are private `runtimeConfig.plutoMail` values. They have empty defaults in
`nuxt.config.ts`, so an environment variable sets each one **at run time**. Do not put them in the
build environment.

| Environment variable             | Value                                                                             |
| -------------------------------- | --------------------------------------------------------------------------------- |
| `NUXT_PLUTO_MAIL_DRIVER`         | `resend`, `dev`, `none`, or the id of a registered driver. Empty means automatic. |
| `NUXT_PLUTO_MAIL_RESEND_API_KEY` | The Resend API key (`re_...`).                                                    |
| `NUXT_PLUTO_MAIL_FROM`           | The From address, for example `Shop <hello@example.com>`.                         |
| `NUXT_PLUTO_MAIL_REPLY_TO`       | The Reply-To address. Optional.                                                   |
| `NUXT_PLUTO_MAIL_MAILPIT_URL`    | The URL of a Mailpit server, for example `http://localhost:8025`. Optional.       |

v1 keeps every secret in the environment. Nothing stores a key in the database, in the settings
table, or in the Git CMS repo. A later version can add a store (`registerMailStore`) that keeps
the key in a vault. The environment always wins over a store.

## Choosing the driver

`resolveMailDriver()` picks the driver in this order:

1. `NUXT_PLUTO_MAIL_DRIVER`: a registered driver, or `resend`, `dev`, `none`. An unknown id gives
   `none` and logs one warning.
2. `resend`, when a Resend key resolves (the environment, then a store).
3. `dev`, in development.
4. `none`.

**Production never falls back to `dev`.** A production site with no key has the `none` driver.

| Driver   | Behavior                                                                                                                                                                                                                                                                                           |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `resend` | Sends through the Resend HTTP API. See below.                                                                                                                                                                                                                                                      |
| `dev`    | In development it prints the email to the server console, text version included, so you can copy an invite link. With `NUXT_PLUTO_MAIL_MAILPIT_URL` it also posts the email to Mailpit (`POST /api/v1/send`). Outside development it logs nothing, and without Mailpit it throws `not_configured`. |
| `none`   | Every send throws `not_configured`. The caller decides what to do.                                                                                                                                                                                                                                 |

### The Resend driver

- Plain `fetch`, no SDK. It sends a `User-Agent` header (Resend refuses a call without one).
- Each attempt has a 4 second timeout.
- Each send has an `Idempotency-Key` (the message key, or a random UUID).
- One retry, with the same key, after a network error, a timeout or a 5xx answer.
- With no From address, it uses `Pluto <onboarding@resend.dev>`. Resend delivers that address only
  to the email of the Resend account, until the site verifies a domain.

## Sending an email

```ts
const email = await renderPlutoEmail(
  'invite',
  { url, inviterName, roles },
  { locale }
)
await sendPlutoMail({ to, ...email })
```

`sendPlutoMail` throws a `PlutoMailError` with a `code`:

| Code                                   | Meaning                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------ |
| `not_configured`                       | No driver can send (driver `none`, or no key).                                 |
| `invalid_key`                          | Resend rejected the key.                                                       |
| `restricted_key`                       | The key is send-only and the call needs full access.                           |
| `test_sender_only`                     | The From domain is not verified. Resend sends only to the account owner.       |
| `domain_not_verified`                  | The From domain is not verified.                                               |
| `invalid_message`                      | The message or the request is not valid (also a line break in a header value). |
| `rate_limited`, `quota_exceeded`       | Too many requests, or the plan limit is used.                                  |
| `timeout`, `network`, `provider_error` | Resend did not answer, was not reachable, or failed.                           |

The error message is fixed English text. It never repeats the provider text, a recipient, a
subject, a link or a key. **Mail code never logs a recipient, a subject, a link or a key.** The one
exception is the `dev` driver, which prints the email in development on purpose.

`sendPlutoMail` also refuses a message with no valid recipient, and a subject, address or
Reply-To with a line break (header injection).

## Templates

An email template is a plain TypeScript function that returns `{ subject, html, text }`. There are
two: `test` and `invite`. `renderPlutoEmail(name, data, { locale?, siteName? })` renders one.

- The texts are the `pluto.mail.*` keys of the locale files. An app can override them. A layer can
  add a language.
- `server/mail/layout.ts` draws a 600 px table layout with inline CSS, a button and the plain link
  under it, and a footer with the site name. It has no image and no tracking.
- Every text goes through `escapeHtml`. A button URL must be `http` or `https`. The subject is on
  one line.
- To add a template, write `server/mail/templates/<name>.ts`, add it to `PlutoEmailTemplates` and
  to the `switch` in `renderPlutoEmail`, and add the `pluto.mail.<name>.*` keys in every locale.

## The server translator

`usePlutoServerTranslator(locale)` returns `{ t, te, tx, locale }` for a server route. It wraps
`createTranslator` (the engine of the admin). The `pluto-i18n` module generates the Nitro virtual
module `#pluto-i18n-server`, with a lazy loader for each locale, from the same
`i18n/locales/<code>.json` files of every layer. A locale matches by code or by base language. An
unknown locale, and a missing key, fall back to the default locale. See the i18n skill.

## The admin routes

All routes live under `/api/_pluto/mail/` and are for administrators only.

| Route                            | Purpose                                                                          |
| -------------------------------- | -------------------------------------------------------------------------------- |
| `GET status`                     | The driver, the From address, and whether a key is set. No secret.               |
| `POST test`                      | Sends the test email to `{ to, locale? }`. 5 calls in 10 minutes for each admin. |
| `POST resend/check-key`          | Checks the key. `full` lists the domains. `sending` means send-only.             |
| `POST resend/domains`            | Creates a domain `{ name, region? }` and returns the DNS records.                |
| `GET resend/domains/:id`         | Reads a domain with its status and records.                                      |
| `POST resend/domains/:id/verify` | Asks Resend to check the DNS now.                                                |
| `POST resend/sending-key`        | Makes a sending-only key `{ domainId? }`. Returns the new key once.              |

Rules for these routes:

- **Fail closed.** `requireMailAdmin` calls `adapter.authorize(event, '*')`. With no content
  adapter, with an adapter that has no `authorize`, or when `authorize` throws, the answer is 403.
  (The generic content routes fail open without `authorize`. These routes do not, because mail
  has no backing store to enforce the rule, and the routes use the server secrets.) A 401 from the
  adapter stays 401.
- A state-changing route also refuses a cross-site request (`Origin` or `Sec-Fetch-Site`).
- **Keys never reach the browser.** The Resend key stays on the server. The status route says only
  whether a key is set. The one key in a response is the new sending-only key, shown once with
  `Cache-Control: no-store`. Nothing stores it.
- The test-email limit counts for one admin session (a hash of the `Authorization` header or the
  cookies, else the IP). It is in memory, so each server instance counts for itself.
- An error answer is a `createPlutoError` with the key `pluto.mail.errors.<code>` and
  `data.mail.code`. The page shows the translated text and reads the code (`plutoMailErrorCode`).

## The Email settings page

`Settings > Email` (`app/pages/admin/settings/email.vue`) is a `settingsPages` entry with the
capability `'*'` (administrators only). It is a guided flow. Each step is a lazy component under
`app/components/Pluto/Mail/`.

A status card comes first (driver, key set or not, From address). Then seven numbered steps:

1. Create a Resend account (a link).
2. Add the API key: the line `NUXT_PLUTO_MAIL_RESEND_API_KEY=...` with a copy button, and a key
   check (full access or send-only).
3. Send a test email to yourself. It works before you verify a domain, with the Resend test
   sender. On the Resend 403, the page explains the test sender rule.
4. Add a domain: name and region, then a table of the DNS records with copy buttons. The
   "Verify" button asks Resend to verify, and the page checks the status every 10 seconds, then
   slower up to 60 seconds. It stops after 10 minutes. A "Check again" button starts it again.
5. Set the From address (and an optional Reply-To): the `NUXT_PLUTO_MAIL_FROM` line to copy.
6. Send a test email to anyone.
7. Optional: make a sending-only key for the domain, to replace the setup key.

### Adding a section: `mailPanels`

A layer adds a section below the steps with the `mailPanels` bucket:

```ts
definePlutoExtension({
  id: 'supabase',
  mailPanels: [
    {
      id: 'auth-emails',
      title: 'supabase.mail.authEmails.title',
      component: AuthEmailsPanel,
    },
  ],
})
```

`title` and `description` are key-or-literal. Register the component with `defineAsyncComponent`.
Core shows a skeleton while the chunk loads, and warns in development about a component that is
not async.

## Rules

- Read a secret only on the server, from `runtimeConfig.plutoMail` or a registered store.
- Never put a key, a recipient, a subject or a link in a log line or in an error message.
- A new driver implements `PlutoMailDriver` and registers with `registerMailDriver`. It throws
  `PlutoMailError`. Add a test with a fake `fetch`.
- Tests never call a real provider. Pass a fake `fetch` (`resolveMailDriver({ fetch })`) or stub
  `globalThis.fetch`.

## Known limits

- v1 keeps the Resend key in the environment only. There is no vault store yet.
- Only Resend has a guided setup. Another provider needs its own driver.
- Supabase sign-in emails (sign-up, password reset, magic link) still go through Supabase's
  mailer. A layer can add a `mailPanels` section that explains how to send them through Resend.
- The test-email limit is per server instance.

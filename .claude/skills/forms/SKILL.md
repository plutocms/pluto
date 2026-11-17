# Forms

`@plutocms/forms` (`packages/layers/addons/forms`) is the add-on layer for forms on any site. An
editor builds a form from blocks. A developer defines a form in code, draws it, adds field types and
hooks the server. Like the other add-ons it does not extend core: the app brings core (0.75.0 or
newer, an optional peer dependency). Adding the layer is the opt-in.

The design and the owner's choices are in `.claude/plan/forms.md` of the workspace. The choices:
editors and developers share one model, the submissions never go in the Git repository, and the
spam protection is built in (Cloudflare Turnstile is optional).

## Files

- `nuxt.config.ts`: `$meta.name: 'forms'`, the CSS, and the scheduled task `pluto:forms:purge`
  (`30 3 * * *`).
- `modules/pluto-forms/index.ts`: the module (`configKey: 'plutoForms'`, found by Nuxt because it is
  in the layer's `modules/` dir). It sets the private `runtimeConfig.plutoForms` (`storage`, `secret`,
  `turnstileSiteKey`, `turnstileSecret`, `minFillSeconds`, `rateLimit`), the public
  `runtimeConfig.public.plutoForms.enabled`, and, in development with no `storage`, the Nitro dev
  storage `pluto-forms` (an `fs` driver on `.data/pluto-forms`).
- `shared/types/forms.ts`, `shared/types/forms-config.d.ts`: the types (`PlutoFormField`,
  `PlutoFormDefinition`, `PlutoPublicForm`, `PlutoFormStore`, the `AppConfig` type).
- `shared/utils/` (auto-imported, pure, the server and the browser share them):
  - `forms-fields.ts`: `plutoFormFields(blocks, { custom })`, `plutoFormNameFromLabel`,
    `plutoFormOptions`, `PLUTO_FORM_BLOCKS`.
  - `forms-validate.ts`: `plutoValidateForm(fields, input, { custom })`, the limits, the error codes.
  - `forms-define.ts`: `definePlutoForm`, `definePlutoFormField`, `plutoMergeForm`,
    `plutoFormSettings`, `plutoFormRecipients`, `plutoPublicForm`, `plutoFormCustomTypes`.
  - `forms-type.ts`: `definePlutoFormType(storage)` and `plutoFormsGitType`.
  - `forms-errors.ts`: `plutoFormErrorMessage`, `plutoFormRedirect`.
  - `forms-csv.ts`: `plutoFormsCsv`, `plutoCsvCell`.
- `server/utils/` (auto-imported in Nitro): `forms-config.ts`, `forms-token.ts`, `forms-spam.ts`,
  `forms-store.ts`, `forms-definitions.ts`, `forms-mail.ts`, `forms-submit.ts`, `forms-runtime.ts`,
  `forms-purge.ts`, `forms-public.ts`, `forms-admin.ts`.
- `server/plugins/forms.ts`, `server/middleware/forms-guard.ts`, `server/tasks/pluto/forms/purge.ts`.
- `server/api/pluto/v1/forms/[handle]/` (public): `index.get.ts`, `token.get.ts`,
  `submissions.post.ts`. `server/api/_pluto/forms/` (admin): `index.get.ts`, `status.get.ts`,
  `[handle]/submissions/index.get.ts`, `[handle]/submissions/[id].get.ts` and `.delete.ts`,
  `[handle]/export.get.ts`.
- `app/`: `app.config.ts`, `plugins/forms.ts`, `composables/pluto-form.ts` (`usePlutoForm`),
  `composables/pluto-form-block.ts` (`usePlutoFormBlockField`), `components/` (`PlutoForm`,
  `PlutoFormControl`, `PlutoFormTurnstile`, the eight `PlutoForm<Kind>` field components,
  `PlutoFormsSubmissionsLink`), `components/content/` (the blocks), `pages/admin/forms/`,
  `pages/admin/settings/forms.vue`, `assets/css/forms.css`.
- `i18n/locales/{en,pt-BR}.json`: the namespace `forms` and `content.form`.
- Tests in `test/`: `forms-fields`, `forms-validate`, `forms-spam`, `forms-submit`, `forms-mail`,
  `forms-public`, `forms-purge-csv`, `forms-define`, `forms-store`, `forms-blocks` (the real parser of
  core), and `store-contract.ts`. `test/setup.ts` puts the auto-imported shared functions on
  `globalThis`, as Nitro does.

**Imports.** The layer's own `shared/utils` is reached through auto-imports from `app/` and
`server/`. A relative import of a value breaks the Nitro server build. A type import can be relative.
A server util may import another server util with a relative path.

## The `form` type

`definePlutoFormType(storage)` (`shared/utils/forms-type.ts`): name `form`, fields `title`, `slug`
(the handle), `recipients` (a text area, one address or more), `subject`, `successMessage`,
`redirect`, `retentionDays` (default 180) and `body` (`widget: 'blocks'`,
`blocks: PLUTO_FORM_BLOCKS`), no status, `trash`, a canvas form. Capabilities `forms:write` (write and
delete) and `forms:read_submissions`.

- The Git CMS stores `content/forms/<handle>.md` (`plutoFormsGitType`, `source: 'forms'`). The Nitro
  plugin and the client plugin register it when `runtimeConfig.public.plutoGithub.enabled` is true.
  A Supabase backend registers its own variant with its storage parts (PR 2).
- **The public API never shows the settings.** `api.fields` is `['title', 'slug', 'successMessage']`,
  and the `toPublic` hook (`createFormsToPublic`, set by the server plugin) adds `fields` and
  `submitLabel` from the body and drops `recipients`, `subject`, `redirect` and `retentionDays` again.
  `test/forms-public.test.ts` runs the real `getPublicContent` and `listPublicContent` of core.
- **The admin content routes are anonymous for a type with no read capability.** A form item holds the
  email addresses, so `server/middleware/forms-guard.ts` requires `forms:write` for every path of
  `/api/_pluto/content*/form`. Do not remove it.

## The field blocks

`form-input` (`type`: text, email, tel, url, number, date), `form-textarea`, `form-select`,
`form-radio`, `form-checkbox`, `form-consent` (required unless `required="false"`, with a `link`),
`form-hidden` (`name`, `value`) and `form-submit` (`label`). Props in common: `label`, `name` (made
from the label when empty), `placeholder`, `help`, `required`, `width` (`full` or `half`).
Others: `minLength`, `maxLength`, `min`, `max`, `pattern`, `rows`, `options`.

- Each is a content component with `definePlutoBlock`, `hidden: true` (only the form editor offers
  them, because its body field lists them in `blocks`), group `form`. They draw the default field
  component, so the editor preview is the real markup (`usePlutoFormBlockField(block, props)` turns the
  props into a field with `plutoFormFields`).
- A block prop cannot be a list, and the MDC props sit on one line. So `options` is one text:
  options separated by `;` (or a new line), and `value|Label` for a value that is not the label.
- `plutoFormFields(blocks, { custom })` takes the Comark document (`{ nodes }`) of the body, in order,
  and returns `{ fields, submitLabel }`. It reads a prop as `minLength`, `min-length` or
  `:min-length`. Names must match `^[a-z][a-z0-9_]{0,39}$`, else they come from the label, and a
  repeated name gets `_2`. Other blocks are skipped.
- `pluto-form` (`content/PlutoForm.vue`) is the embed block: `::pluto-form{form="contact"}`. It imports
  the default component by path, because a component that uses its own file name in the template
  renders itself. The same rule is why the field components are `PlutoForm<Kind>` and the blocks
  are `Form<Kind>`.

## Validation

`plutoValidateForm(fields, input, { custom })` returns `{ values, errors }`. The errors are codes
(`required`, `invalid`, `tooShort`, `tooLong`, `tooSmall`, `tooBig`, `option`, `unknown`), or the text
of a custom validator. The browser maps a code to a text with `plutoFormErrorMessage` and the
`forms.errors.*` messages.

- A key that is not a field is `unknown`. A value must be a text, a number or a boolean.
- Limits: 500 characters for a text, 5000 for a text area (a `maxLength` can only lower them), 254
  for an email, 65 536 bytes for a body.
- An email must be one plain address: a comma, a space, a quote or a line break is `invalid`.
- A `pattern` must match the whole value. A bad pattern is ignored.
- Clean values: a number field gives a number, a checkbox and a consent give a boolean.

## Code forms and field types

Both go in `app.config.ts` under `plutoForms`, because both the app and the server read the app config,
the lists of the layers join (defu concatenates arrays), and no build step is needed. (The other way,
a module that collects a `forms/` folder, needs a virtual module for each side.)

- `definePlutoForm({ handle, title, fields, submitLabel?, settings? })` checks the handle
  (`PLUTO_FORM_HANDLE`) and fills the defaults.
- A code form and a `form` item with the same handle merge (`plutoMergeForm`): the structure is the
  code, the title and the settings are the item's when it sets them (an empty or bad value keeps the
  code's). The item's body is ignored then. **Not done:** the admin does not yet show a code form in the
  list of the `form` type, nor edit its texts. A code form shows in Submissions, and a form item with the
  same handle is the way to change its texts.
- `definePlutoFormField({ name, block, validate, component })`: `block` is the block name (the server
  reads a body with it), `validate(value, field)` returns an error text, `component` is the **name** of a
  global component (`components/global/`) that draws the field. A name is used because the Nitro bundle
  reads `app.config.ts` too, and it cannot import a `.vue` file.

## Rendering

- `usePlutoForm(handle)`: `definition`, `fields`, `values`, `errors` (texts), `errorList`, `status`
  (`idle`, `submitting`, `success`, `error`), `message`, `submit()`, `reset()`, `honeypot`, `summary` (a
  ref for the error summary, which takes focus after a failed check) and `turnstile`
  (`siteKey`, `token`, `key`). It reads `GET /api/pluto/v1/forms/<handle>`, asks for the token after the
  mount, validates with `plutoValidateForm`, posts the clean values, and follows `redirect`.
- `<PlutoForm :handle>`: a `novalidate` form, the title as hidden text, the error summary (links that
  focus the field), the field components, the honeypot input `hp`, the Turnstile widget, the submit
  button, and a `role="status"` live region that is always in the page.
- Field components (`PlutoFormInput`, `PlutoFormTextarea`, `PlutoFormSelect`, `PlutoFormRadio`,
  `PlutoFormCheckbox`, `PlutoFormConsent`, `PlutoFormHidden`, `PlutoFormSubmit`): the props `field`,
  `id`, `modelValue`, `error`, `disabled`; the event `update:modelValue`. The label, the help and the
  error text come from `PlutoFormControl`, which sets `aria-describedby`. The input sets
  `aria-required` and `aria-invalid`. An app overrides one with a component of the same name.
- `forms.css`: plain CSS in `@layer components`, every selector in `:where()`. The variables
  (`--pluto-form-*`) read `--pluto-blocks-*`, then `--ui-*`, then a neutral value.

## The submit route

`POST /api/pluto/v1/forms/<handle>/submissions` with `{ values, token, hp, turnstile }` runs
`submitPlutoForm(deps, { handle, ip, body })` (`server/utils/forms-submit.ts`; the route gives it the real
parts with `createFormsSubmitDeps`, so the tests give fakes). The order:

1. No store: `503` (`no-store`). No secret: `503` (`no-secret`).
2. A body over 64 KB: `413`. A body that is not a JSON object: `400`.
3. Spam (`checkFormsSpam`): the rate limit of the IP (`429` and `Retry-After`), the honeypot (an
   answer `200`, nothing stored), the signed token (`400` `token` for a bad, too fast or old one),
   Turnstile when both keys are set (`400` `turnstile`).
4. The form (`404`), the validation (`422` with `errors`), the `pluto:forms:before-store` hook (a
   `context.reject(message)` gives `422` `rejected`; another error gives `500`).
5. `store.add`, then the email, then `pluto:forms:submission`. An email or hook failure is logged and
   does not change the answer. A store failure gives `500` with no detail.
6. `{ ok: true, message, redirect? }`.

- **The token** (`forms-token.ts`): `base64url("<handle>.<ms>.<nonce>")` and an HMAC-SHA256
  signature. `GET /api/pluto/v1/forms/<handle>/token` makes it, with no cache, after the mount, so a
  cached or static page still gets a fresh one. It must be at least `minFillSeconds` (3) and at most 24
  hours old.
- **The secret** (`readFormsConfig`): `NUXT_PLUTO_FORMS_SECRET`, else a key derived (HMAC) from the
  session password of the Git CMS, else (development only) a random secret for the process.
- **The rate limiter** is a copy of the one in `modules/pluto-github` (`createFormsRateLimiter`): that
  one is private to the Git CMS module. A site with many servers has one window for each server.
- **Turnstile** (`NUXT_PLUTO_FORMS_TURNSTILE_SITE_KEY`, `NUXT_PLUTO_FORMS_TURNSTILE_SECRET`): the
  token route gives the site key, so it needs no public config. A network error counts as a failure.
- **The email** (`renderFormsEmail`): `sendPlutoMail` to the recipients. Every label and value is
  escaped in the HTML. The subject is one line (no control character), and the Reply-To is the first
  `email` field value that is one plain address (`formsReplyTo`).
- **The hooks** are Nitro runtime hooks (typed in `forms-runtime.ts`). Their `context` has `form`
  (`handle`, `title`), `values` (frozen), `ip`, `reject`, and, for `submission`, `submission`.

## The store

`PlutoFormStore`: `add`, `list(form, { limit, offset })` (newest first, with `total`), `get`,
`delete`, `purge(form, olderThan)` (returns the count). `chooseFormStore` picks: a store from
`registerFormStore`, else the Nitro mount named by `plutoForms.storage`, else (development) the
`pluto-forms` dev mount, else none. A name with no mount is `missing-mount`, not a store, because the
default memory storage would lose the data. The storage store keeps one item for each submission with
the key `<form>:<13 digit ms>-<8 hex>`, so the keys sort by date and `purge` needs no read. It reads
every key of a form to list it, so a big volume needs a database store.

**What the Supabase store needs** (PR 2): the table `form_submissions` with `id` (the id of the
submission, text or uuid), `form` (text, the handle), `values` (jsonb), `created_at`
(timestamptz, default `now()`), an index on `(form, created_at desc)`, and row level security with
no public policy (the server uses the service key). The `form` content type needs its own table
`forms` (`slug` as the handle, `title`, `recipients`, `subject`, `success_message`, `redirect`,
`retention_days`, `body`, `created_at`, `updated_at`, `deleted_at` for the trash). The store registers
itself with `registerFormStore`, and its test calls `describeFormStoreContract`.

## Retention

`pluto:forms:purge` (`server/tasks/pluto/forms/purge.ts`) calls `purgeFormSubmissions(store, forms)`
for the forms of `listFormSummaries()` (the code forms and the `form` items, read with a system
request). A form with `retentionDays` 0 is skipped. A store error for one form does not stop the others.

## The admin

- The forms list and the editor come from the content type (the Git CMS registers it in the client
  plugin with `contentTypes`).
- `/admin/forms`: every form. `/admin/forms/<handle>`: the table (the date and the first three
  fields), paging, a slideover with all values, a two-step delete, and **Export CSV**
  (`/api/_pluto/forms/<handle>/export`, at most 10 000 rows; `plutoFormsCsv` puts a `'` before a cell that
  starts with `=`, `+`, `-`, `@`, a tab or a carriage return). The nav item and the routes need
  `forms:read_submissions`.
- `/admin/settings/forms`: the state of the store, the secret, Turnstile and email, with steps for
  Vercel, Netlify, Cloudflare and an own server (no CLI), and the `nuxt.config.ts` text to paste. The
  route `GET /api/_pluto/forms/status` needs an admin (`*`) and never returns a secret.
- The form editor toolbar has a link to its submissions (`PlutoFormsSubmissionsLink`).

## Not in this version

- A code form in the admin list of the `form` type, and editing its texts there.
- A store with a database index for a big volume (the Supabase store).
- Files in a form, and a multi-step form.

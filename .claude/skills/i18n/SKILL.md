# Internationalization (i18n)

Pluto has its own small i18n engine. It has no `@nuxtjs/i18n` dependency. It translates the admin
UI and, with a separate scope, the public site. The shipped languages are `en` (the default) and
`pt-BR`. A new language is a new set of JSON files. It needs no code change.

The message format stays vue-i18n compatible: `{name}` for values, and ` | ` for plural forms.

## Files

- `modules/pluto-i18n/index.ts` — the Nuxt module (config key `plutoI18n`). It scans every layer
  and the app for `i18n/locales/<code>.json` and generates `#build/pluto-i18n.mjs` (and a
  `.d.mts`).
- `modules/pluto-i18n/locale-files.ts` — pure helpers: `findLayerLocaleFiles`,
  `renderI18nTemplate`, `resolveNuxtUiLocaleFile`, `matchLocale`, `resolveI18nOptions`.
- `app/composables/internal/i18n-core.ts` — the pure engine: `createTranslator`, `interpolate`,
  `selectPlural`, `isMessageKey`, `flattenMessages`, `formatNumber`, `formatDate`, and more. It
  sits under `internal/` so plain Vitest can import it.
- `app/composables/internal/i18n-runtime.ts` — the Nuxt-aware part: the shared caches, language
  detection, and the first-locale resolve.
- `app/composables/pluto-i18n.ts` — `usePlutoI18n()` (admin scope) and `usePlutoSiteI18n()` (site
  scope).
- `app/composables/pluto-content-text.ts` and `internal/content-text.ts` — `usePlutoContentText(type)`,
  `usePlutoContentTexts()`, and the pure `createContentText`.
- `app/composables/pluto-error.ts` and `internal/error-text.ts` — `usePlutoErrorText()`.
- `server/utils/pluto-error.ts` — `createPlutoError()`.
- `app/plugins/pluto-i18n.ts` — resolves both locales and awaits their messages before render.
- `app/components/Pluto/Settings/PlutoSettingsLanguage.vue` — the language card on
  `/admin/settings`.
- `i18n/locales/en.json`, `i18n/locales/pt-BR.json` — core's messages.
- `shared/types/registry.ts` — `PlutoLocaleDriver`.
- `test/i18n-core.test.ts`, `test/i18n-locale-files.test.ts`, `test/pluto-i18n-module.test.ts`,
  `test/fixtures/i18n-stub.ts`.

## Locale files and namespaces

Each layer, and the app, keeps its text in `i18n/locales/<code>.json`. A file name counts only if
the code is valid (`en`, `pt-BR`). The files of all layers merge by locale, base layer first and
the app last. The app overrides a layer's text.

Each layer owns one top-level namespace, its `$meta.name`: `pluto`, `supabase`,
`supabase-storage`, `supabase-shop`, `supabase-blog`. Shared words go in `pluto.common.*`. Content
types use `content.<typeName>.*`, owned by the layer that declares the type. Public app text uses
`site.*`.

`test/i18n-locale-files.test.ts` checks every core locale against `en`: same keys, same
`{placeholders}`, same plural form count, no empty value, known top-level namespaces only.

## Options

Set them under `plutoI18n` in `nuxt.config.ts`. All are optional.

| Option | Default | Meaning |
|---|---|---|
| `defaultLocale` | `en` | The fallback, and the last choice of every resolve order. |
| `adminLocales` | every discovered locale | The languages the admin offers. |
| `siteLocales` | every discovered locale | The languages the public site can use. |
| `siteLocale` | `defaultLocale` | The site language before a visitor picks one. |

The module drops a locale that has no file, and warns. It puts the resolved values in
`runtimeConfig.public.plutoI18n`. In dev, a new or removed locale file regenerates the loaders.
Restart the dev server after you add a new language, so the option defaults pick it up.

## Two scopes

The admin and the site each have an active locale. They share one message cache.

- `usePlutoI18n()` is the admin scope. It is per user.
- `usePlutoSiteI18n()` is the site scope. The app owns it. It does not follow the admin language.

Both return `{ locale, locales, uiLocale, t, tx, te, n, d, setLocale }`.

- `t(key, params?)` translates a key. A number as the second argument is the plural count.
  Fallback order: the active locale, `en`, then the key itself. In dev, a missing key warns once.
- `tx(value)` translates a key-or-literal. It translates only when `isMessageKey(value)` is true
  and the key exists. Otherwise it returns the value unchanged.
- `te(key)` tells if a key exists (active locale or `en`).
- `n(value, options?)` and `d(value, options?)` format a number and a date with `Intl`. The
  formatters are cached for each locale and options.

A message key matches `/^[a-z][a-z0-9-]*(\.[A-Za-z0-9_-]+)+$/`. A plain English label does not
match, so a literal is safe to pass to `tx()`.

### Plurals

A message with ` | ` has plural forms. Three forms are `zero | one | other`. Two forms are
`one | other`, chosen by `Intl.PluralRules` of the locale. For the count 0, the three-form
message always uses the first form. This matters in pt-BR, where `PluralRules` gives `one` for 0.

### Admin only

- `preference` is the stored choice, or `null` for Automatic.
- `setLocale(code | null)` switches at once. `null` is Automatic: the browser language is
  detected again. The cookie `pluto-admin-locale` keeps the explicit code, and is cleared for
  Automatic. Then `driver.save(code | null)` runs if a locale driver is registered. A driver
  error rejects the promise, and the switch stays.
- `syncUserLocale()` calls the locale driver's `load()`. A stored code switches the admin and
  sets the cookie. `null` clears the cookie and uses the browser language. No driver, or an
  error: nothing changes.

### Site only

`setLocale(code)` switches the site language and sets the `pluto-site-locale` cookie.

## How the first locale is chosen

The plugin `app/plugins/pluto-i18n.ts` resolves both locales, then awaits their messages and
their Nuxt UI locale object before the first render. The state is in
`useState('pluto-admin-locale')` and `useState('pluto-site-locale')`, so the client reuses the
server value.

- Admin: cookie `pluto-admin-locale`, then the browser language matched to `adminLocales`, then
  `defaultLocale`. The server reads `Accept-Language`. The client reads `navigator.languages`.
  The server never reads `navigator`. The admin navbar renders on the server on public pages, so
  the admin locale must resolve there too.
- Site: cookie `pluto-site-locale`, then the `siteLocale` option, then `defaultLocale`.

## Nuxt UI and the html tag

Nuxt UI has one locale for each page. `PlutoRoot.vue` passes `:locale` to `UApp`: the admin
locale's Nuxt UI object on routes under `/admin`, and the site locale's on the rest. The module
picks the Nuxt UI file for each code: `pt-BR` gives `pt_br`, else the base language, else `en`.
`PlutoRoot.vue` sets `<html lang dir>` on routes under `/admin`, from the admin locale. On the
other routes it sets them from the site locale only when the app uses the site scope, which
means the app sets `plutoI18n.siteLocale` or `plutoI18n.siteLocales`
(`runtimeConfig.public.plutoI18n.siteManaged`). Otherwise the app keeps its own
`app.head.htmlAttrs`. Example: a Portuguese site with `lang: 'pt-BR'` in `nuxt.config.ts` and
no site options keeps `pt-BR`.

## The locale driver

A backend layer registers `localeDriver` in `definePlutoExtension` (see the extension-registry
skill). The last registered driver wins. Core ships no driver. Without one, the language choice
lives in the cookie only.

## The Settings language card

`PlutoSettingsLanguage` is a "Your preferences" card at the top of `/admin/settings`. It needs no
capability and no settings driver. It has one select: "Automatic (browser)", then each admin
locale named in its own language through `Intl.DisplayNames` ("English", "Português (Brasil)"). A
change switches at once and shows a success toast. If `driver.save` throws, the switch stays on
this device and an error toast shows the reason.

## How to translate a component

1. Call `const { t, n, d } = usePlutoI18n()` in `<script setup>`.
2. Replace each literal with `t('pluto.<area>.<name>')`. Put a shared word in `pluto.common.*`.
3. Pass a value as a parameter: `t('pluto.list.empty', { labelPlural })`. Never build a sentence
   from pieces in code. Word order differs between languages.
4. Add the key to `i18n/locales/en.json` and `i18n/locales/pt-BR.json`. Both files need the same
   keys, the same `{placeholders}`, and the same number of plural forms. A test checks this.
5. Format numbers and dates with `n()` and `d()`. Do not call `Intl` or `toLocale*String()` with
   the browser default. They follow the admin language.
6. Use a getter for `useHead`, so a language switch updates the title:
   `useHead({ title: () => t('pluto.pages.settings') })`. Every page needs a title. Core adds the
   site name (see the admin-shell skill).
7. Read `t()` inside a template or a `computed`. A value that you read once in setup does not
   change when the language changes.

**The English text stays byte-identical.** The English value of a key is the exact text the UI
showed before: same punctuation, same ellipsis character, same capital letters. Do not reword
English while you extract it.

A phrase takes the content type labels as parameters, for example `{label}` and `{labelPlural}`.
The code passes them in lowercase for use inside a sentence (`text.labelPluralLower`). The title
case form (`text.labelPlural`) is for headings. pt-BR phrases are verb-first and gender-neutral,
for example "Ainda não há {labelPlural}".

A test (`test/i18n-locale-files.test.ts`) scans `app/`, `shared/` and `server/` for literal
`t('pluto.…')`, `tx('pluto.…')`, `key: 'pluto.…'`, and key-shaped strings in plugin
registrations. Every key it finds must exist in `en.json`. A key that you build at run time
(for example `pluto.validation.${code}`) the scan cannot see. Keep such keys in a list in the
test.

### Plurals

`t(key, count)` takes a number as the plural count. It also sets `{count}`. Example:
`"drafts": "draft | drafts"`. Use three forms (`zero | one | other`) when 0 needs its own text.

## Content type text: `usePlutoContentText`

A content type keeps English literals. `usePlutoContentText(type)` takes a type (or a ref, or a
getter) and returns the text of the type:

| Value | Key tried first | Fallback |
|---|---|---|
| `label`, `labelPlural` | `content.<name>.label`, `.labelPlural` | `type.label`, `type.labelPlural` |
| `labelLower`, `labelPluralLower` | the two above, in lowercase | the same |
| `newLabel` | `content.<name>.new` | the phrase `pluto.content.new` with the label |
| `fieldLabel(field)` | `content.<name>.fields.<field>.label` | `field.label` |
| `field(field)` | `…fields.<field>.label`, `.description`, `.placeholder`, `.options.<value>` | the literals |
| `statusLabel(value, literal?)` | `content.<name>.status.<value>` | `literal`, else the value |

A key counts only when it exists. A type with no keys keeps its English text. `field(field)`
returns a translated **copy**, and never changes the field of the type. `PlutoContentField`
passes this copy to the widget, so a widget from any layer shows translated text with no change.
`PlutoContentField` has an optional `type` prop (the type name) for this. Without it, the field
keeps its own text.

Use `usePlutoContentTexts()` (it returns `(name) => text`) where one component shows many types.
In a composable that loops over types, use `contentTextFor(type, usePlutoI18n())` from
`internal/content-text.ts`.

Server code, and any code that reads `type.label` directly, keeps the English text. Core declares
no content type. The layer that declares a type adds the `content.<name>.*` keys to its own
locale files. The locale-file test allows the top-level `content` namespace for this.

## Registry text

A registry entry holds a key or a literal. The consumer composables resolve it with `tx()` inside
a `computed`, so a language switch updates it: `usePlutoAdminNav`, `usePlutoCommandPalette`,
`usePlutoSettingsPanels`, `usePlutoDashboardWidgets`, `usePlutoAdminPages`,
`usePlutoContentActions`, and `usePlutoCapabilities`. `usePlutoAdminNav` resolves the labels
after the legacy dedupe, which compares the raw labels. Core's own registrations
(`app/plugins/pluto-core-registrations.ts`) use keys, such as `pluto.nav.home`.

## Validation messages

`validateContentPayload` returns `ContentValidationError`: `{ field, message, code?, params? }`.
`message` is English and never changes. `code` is one of `required`, `number`, `integer`, `min`,
`max`, `boolean`, `option`, `maxLength`. `params` holds the values: `{ min }`, `{ max }`.

Each code has a key `pluto.validation.<code>`. The placeholders are `{label}` and the params.
`PlutoContentForm` shows `t('pluto.validation.<code>', { label, ...params })` with the translated
field label when the error has a `code`. Without a code, it shows `message`. A new rule needs a
new code, a key in both locale files, and a test.

## Server errors

A server route throws `createPlutoError({ statusCode, message, key, params?, data? })` (from
`server/utils/pluto-error.ts`, auto-imported in Nitro). The `statusMessage` is the English
`message`. The response also holds `data.i18n = { key, params }`, next to any other `data`.
Server code and logs stay English.

On the client, `usePlutoErrorText()` returns `(error, fallbackKey?) => string`. The order is:

1. The translated `data.i18n` (the key must exist). It reads `error.data.data.i18n` for a
   `$fetch` error, and `error.data.i18n` for an error that Nuxt created on the client.
2. The `statusMessage`, then the `message`, of the response body. Then the `statusMessage` of
   the error itself, which a `$fetch` error copies from the HTTP status text (generic, and empty
   over HTTP/2).
3. The translated fallback key. The default is `pluto.errors.unknown`.

Use it where the UI shows a server error, as `PlutoContentForm` does for a failed save or delete.
Core keys for the content routes are `pluto.errors.*`.

## Testing

Pure engine code runs under plain Vitest. To stub `usePlutoI18n` in a test, use
`test/fixtures/i18n-stub.ts`:

```ts
vi.stubGlobal('computed', computed)
vi.stubGlobal('usePlutoI18n', () => createI18nStub())
```

## Not translated

- A DB-backed label (categories, availability, roles) stays as stored.
- The 404 of the generated content pages (`createError` with `statusMessage`) stays English. The
  app's error page owns that screen.
- The placeholder page `app/pages/index.vue` of the core playground app stays English.
- Shop currency formatting stays BRL.

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
`PlutoRoot.vue` sets `<html lang dir>` with the same rule.

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

## Validation messages

Core has the keys `pluto.validation.*` (`required`, `number`, `integer`, `min`, `max`, `boolean`,
`option`, `maxLength`). The English text is the same as the messages of `validateContentPayload`.
The validator still returns English. **P2 will wire the codes and params to these keys.**

## Testing

Pure engine code runs under plain Vitest. To stub `usePlutoI18n` in a test, use
`test/fixtures/i18n-stub.ts`:

```ts
vi.stubGlobal('computed', computed)
vi.stubGlobal('usePlutoI18n', () => createI18nStub())
```

## Left for the next pass (P2)

- Translate the strings of the existing admin components.
- `ContentValidationError` gets a `code` and `params`.
- `createPlutoError` for server errors, and `usePlutoErrorText()` on the client.
- `usePlutoContentText(type)`, and the lookup of the `content.<name>.*` convention keys (see the
  content-model skill).

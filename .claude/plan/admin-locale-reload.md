# The admin language resets to English on reload

Status: done
Started: 2026-10-25
Projects: pluto (fix, 0.20.2), nuxt-content (fix, 0.3.1)
Branch / PR: pluto #211 (release 0.20.2); nuxt-content #12 (release 0.3.1)

## Context

- User (2026-10-25): the admin language does not persist on page reload. Also the Nuxt Content
  type shows "Page" in Portuguese ("Criar Page", "Editar Page", sidebar "Pages").
- Reproduced in Chrome (CDP): after choosing Português, the `pluto-admin-locale` cookie is
  `pt-BR`, and after a reload of `/admin/home` the state is `en` (preference `pt-BR`).
- Cause: `useLocaleScope` creates `useState('pluto-admin-locale')` with the default locale. The
  client plugin `pluto-auth-sync` calls `usePlutoI18n()` before the `pluto-i18n` plugin runs
  (plugins run in name order), so the state exists as `en` and the plugin's resolver never runs.
  Server-rendered pages hide it (the server resolves first). The admin is client-only, so it
  shows there.
- Fix: one resolver for the initial value (`resolveScopeLocale`) used by every `useState` of a
  scope, so the order of the plugins does not matter; and `pluto-auth-sync` depends on
  `pluto-i18n`.
- Labels: the nuxt-content layer adds the `content.doc.*` keys (en, pt-BR) for the default `doc`
  type, and its bar uses the core `pluto.content.edit` key.

## Checklist

- [x] Core: `resolveScopeLocale`, `dependsOn`, test, skill note.
- [x] Core release 0.20.2; check the reload in Chrome.
- [x] nuxt-content: `content.doc.*` keys, core edit key; release 0.3.1.
- [x] Docs site lock.

## Log

- 2026-10-25: reproduced and found the cause.
- 2026-10-25: done. pluto 0.20.2 and nuxt-content 0.3.1 on npm. Checked in Chrome (CDP) with the
  admin in pt-BR: the reload keeps pt-BR; the bar shows "Criar Página" and "Editar Página", the
  sidebar "Páginas", the form "Título", "Caminho", "Descrição", "Conteúdo". Docs site and the
  consumer app updated (the consumer commit is not pushed).

<img width="335" height="105" alt="image" src="https://github.com/user-attachments/assets/1cf11470-ea54-416e-a940-7221fffef1e2" />

# Pluto

A layer-based CMS powered by [Nuxt](https://nuxt.com/).

> [!WARNING]
> Pluto is currently in **alpha** and at a very early stage. Expect breaking changes, incomplete features, and rough edges.

Pluto is designed to be modular, extensible, and developer-friendly. Instead of a monolithic system, it lets you compose your CMS using layers. You only install what you need.

## Features

* Layer-based architecture using Nuxt Layers
* Modern SSR + SPA hydration with Nuxt
* TypeScript-first developer experience
* Opt-in features instead of global plugin mutations
* Works as a full CMS with a Supabase backend, or as a standalone CMS on GitHub
* Standalone mode: a Markdown blog stored in GitHub, with no database

## Requirements

* Node.js 22 or newer, or Bun
* npm, pnpm or Bun

## Getting started

Create a new Pluto project using the CLI:

```bash
npm create pluto@latest

# or
pnpm create pluto@latest

# or
bun create pluto@latest
```

This will launch an interactive setup wizard where you can:

* Choose a database provider
* Configure database credentials (all stored locally on your project's .env)
* Select a starter template (blog, store, etc.)

Then:

```bash
cd your-project
npm install # or pnpm install, or bun install
npm run dev # or pnpm dev, or bun run dev
```

## Architecture overview

Pluto is built around **layers**, each responsible for a specific concern.

### Core layer (`@plutocms/pluto`)

The core layer provides the foundation for your CMS:

- `<PlutoRoot>`: Wraps your entire app (used in `app.vue`). Includes the admin navbar, `NuxtLayout`, `NuxtLoadingIndicator`, and base styles.
- `<ColorModeButton>`: Light/dark mode toggle with zero configuration.
- Built-in auth and admin layouts, the `/admin` route, the `/admin/login` page, the route guard and the admin navbar. A backend layer plugs in with an auth driver (`authDriver` in `definePlutoExtension`). See `.claude/skills/admin-shell/SKILL.md`.
- `<PlutoNavbarAdmin>` and `<PlutoNavbarAdminActions>`
  Provide structure for injecting actions from other layers

A layer plugs into the admin UI with one function, `definePlutoExtension`, called from a
plugin. It registers any of: an auth driver, navbar actions, sidebar nav entries, admin page
metadata, dashboard widgets, and a settings panel or driver:

```ts
// app/plugins/pluto-registrations.ts
export default defineNuxtPlugin(() => {
  definePlutoExtension({
    id: 'supabase-blog',
    nav: [{ id: 'posts', label: 'Posts', icon: 'lucide:file-text', to: '/admin/posts' }],
  })
})
```

See `.claude/skills/extension-registry/SKILL.md` for the full type of each registrable thing
and the ordering/dedupe rules. The old `useNavbarAdmin().registerNavbar(component)` and
`useNavbarAdminActions().addAction(component)` composables still work, through a compatibility
bridge, but `definePlutoExtension` is the current recommended way to plug in.

### Backend layers

Backend layers handle data, authentication, and APIs.

- `@plutocms/supabase`
  Provides Supabase integration (database, auth, users, roles, migrations).
- `@plutocms/supabase-storage`
  Adds media upload and the media library on Supabase Storage. It brings `@plutocms/supabase`.
- Future possibilities: other database providers and backend-as-a-service providers.

### Feature layers

Feature layers add domain-specific functionality on top of backend layers.

- `@plutocms/supabase-shop`
  Adds e-commerce features: products and a product media gallery. It brings `@plutocms/supabase`
  and `@plutocms/ui`.
- `@plutocms/supabase-blog`
  Adds blog posts with a rich text editor and image upload. It brings `@plutocms/supabase`,
  `@plutocms/supabase-storage` and `@plutocms/ui`.
- `@plutocms/nuxt-content`
  Edits the Markdown files of a [Nuxt Content](https://content.nuxt.com/) site through the
  standalone GitHub CMS. It brings `@plutocms/pluto`.

### Shared packages

- `@plutocms/utils`: shared helpers. `@plutocms/pluto` brings it.
- `@plutocms/ui`: shared UI components. The shop and blog layers bring it.

> A feature layer brings its upstream layers. An app extends only the top layer it uses. For
> example, an app that extends `@plutocms/supabase-shop` gets `@plutocms/supabase` and
> `@plutocms/pluto` with it.

## Using Pluto in existing Nuxt projects

Pluto is not limited to new projects.

You can extend an existing Nuxt app with the top layer you need. Install it, then extend it with
`install: true`:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  extends: [['@plutocms/supabase-shop', { install: true }]],
})
```

The `package.json` of the app lists only that layer, besides `nuxt`, `vue` and `vue-router`. For
the core layer alone, use `[['@plutocms/pluto', { install: true }]]`.

### Styles: one Tailwind build

Your app owns the only Tailwind build. Pluto layers do not register their own. Start your
CSS entry with these three imports, then add your own theme after them:

```css
/* app/assets/css/main.css */
@import 'tailwindcss';
@import '@nuxt/ui';
@import '#build/pluto.css';

@theme {
  /* your site's tokens */
}
```

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  css: ['~/assets/css/main.css'],
})
```

`#build/pluto.css` brings in the CSS of every Pluto layer, including the admin theme. Nuxt UI
already scans the source of every layer. If your app has no Tailwind entry, Pluto uses a
fallback entry. If the setup is wrong, the build prints a `pluto-css` warning with the fix.

The admin keeps its own palette and font. Your site's `app.config` colors and `@theme`
tokens do not change the admin.

## Standalone mode: a Markdown blog in GitHub

`@plutocms/pluto` can run on its own, with no database and no other layer. Posts are Markdown
files in a GitHub repository. Editors write them in the Pluto admin, and each save is a commit.
The public site reads the posts from GitHub at runtime, with a cache, so a save publishes in
seconds without a new build.

The quickest start is the template:

```bash
bunx create-pluto@latest my-blog -t core-blog
```

Or use it in an existing app. It is on by default (`plutoCms.enabled: 'auto'`), and it stays
off next to a backend layer such as the supabase layer. It needs no option:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  extends: [['@plutocms/pluto', { install: true }]],
})
```

Posts live in `content/posts/<slug>.md`. In development, the CMS reads and writes the local
`content/` folder. In production, it uses GitHub. Pluto finds the repository from
`PLUTO_CMS_REPO`, from Vercel, or (in development) from the `origin` git remote. Set
`plutoCms.github.repo` only when none of these works.

- **Sign-in:** with a GitHub App. Users with push access to the repository are editors.
  Commits carry the name of the editor.
- **Drafts:** `status: draft` in the frontmatter. The public routes never show them. In a
  public repository, drafts are still readable on GitHub, and the admin warns about this.
- **Public pages:** `usePlutoCmsList('post')` and `usePlutoCmsItem('post', slug)` read the
  published posts. `<PlutoMarkdown :html="post.html" />` shows a post as sanitized HTML.
- **Editor:** a Markdown editor with a Visual/Source switch. Source mode is a plain text area
  that never rewrites the text, so a post with a table or raw HTML stays safe.
- **Nested content types:** a type with `files: { nested: true }` stores its items in folders.
  Ids are paths, such as `1.start/2.install`. A docs site needs this.
- **No empty commits:** a save that does not change the file text makes no commit.
- **Your own types:** set `plutoCms.postType: false` when a layer brings its own content types
  and you do not want the built-in `post` type.
- **Admin bar:** the admin bar shows on public pages for signed-in staff. A site can offset its
  own header with the `--pluto-admin-bar-height` CSS variable or with `usePlutoAdminBar()`.
- **Development:** the default storage in dev is `fs`. It reads and writes the local
  `content/` folder, so a dev server never writes to the real repository.

The GitHub App setup, the environment variables and every option are in the template README
and in `.claude/skills/github-cms/SKILL.md`.

## Reading your data

- Inside a Nuxt app, use the composables of each layer, such as `usePlutoCmsList` and
  `usePlutoCmsItem` in standalone mode.
- The layers expose REST routes under `/api/_pluto/`. The admin uses these routes. Each layer's
  skill lists its routes and access rules.

## Why not just WordPress?

- Modern SSR and SPA hydration via Nuxt
- TypeScript-first experience
- Better control through Vue composables
- Deployment flexibility: any host that runs a Nuxt app

If you're a Vue developer, you'll feel right at home.

## Roadmap ideas

- More official backend layers
- Rich ecosystem of feature layers
- Better developer tooling and DX improvements
- Community layers are very welcome! ❤️

## License

MIT, as set in `package.json`. This repository does not have a `LICENSE` file yet.


## Local layers (Pluto development)

An app imports the `plutoLayer` helper to extend a Pluto layer. By default, it returns the npm
package. With `PLUTO_LOCAL_ROOT` set (for example `PLUTO_LOCAL_ROOT=..` in `.env`), it uses the
local checkouts under that folder.

```ts
// nuxt.config.ts
import { plutoLayer } from '@plutocms/pluto/layers'

export default defineNuxtConfig({
  extends: [plutoLayer('@plutocms/supabase-shop')],
})
```

With pnpm, add `@plutocms/pluto` to the dependencies of the app, so the import works. See
`.claude/skills/local-layers/SKILL.md`.

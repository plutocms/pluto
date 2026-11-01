<img width="335" height="105" alt="Pluto" src="https://github.com/user-attachments/assets/1cf11470-ea54-416e-a940-7221fffef1e2" />

# Pluto

A layer-based CMS built on [Nuxt](https://nuxt.com/). Use it in your Nuxt app, or headless from any
framework or stack through its public API. You add only the layers you need.

> [!WARNING]
> Pluto is in **alpha**. Expect breaking changes, incomplete features, and rough edges.

**Docs:** [pluto.vulmix.dev](https://pluto.vulmix.dev)

## Quick start

```bash
npm create pluto@latest
```

The CLI asks for a template and a package manager, installs the dependencies, and shows the
command that starts the dev server. Open `/admin` to edit your content.

## Add Pluto to a Nuxt app

```bash
npm install @plutocms/core
```

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  extends: ['@plutocms/core'],
})
```

Core is the base layer every Pluto app extends. With no other layer, Pluto is a Markdown CMS on
Git: posts are files in your repository, and each save is a commit. It works out of the box with your local Git repo in development. Connect GitHub
to publish from a deployed site. See [Git CMS](https://pluto.vulmix.dev/docs/git-cms/quickstart).

## Use it headless

A site in any framework reads the published content from the public API:

```bash
curl https://your-site.dev/api/pluto/v1/content/post?limit=10
```

See [Public API](https://pluto.vulmix.dev/docs/core/public-api).

## Layers

| Package                   | What it adds                                             |
| ------------------------- | -------------------------------------------------------- |
| `@plutocms/core`          | The core: the admin, the content model, and the Git CMS. |
| `@plutocms/docs`          | A visual editor for the pages of a Nuxt Content site.    |
| `@plutocms/supabase`      | A Supabase backend: database, auth, users, and roles.    |
| `@plutocms/supabase-blog` | Blog posts on Supabase.                                  |
| `@plutocms/supabase-shop` | Products on Supabase.                                    |
| `@plutocms/3d`            | 3D models in the media library, and a viewer.            |

Read [Layers](https://pluto.vulmix.dev/docs/core/layers) to see how they fit together.

## This repository

| Folder                      | Package          |
| --------------------------- | ---------------- |
| `packages/core`             | `@plutocms/core` |
| `packages/layers/addons/3d` | `@plutocms/3d`   |

## Links

- [Create a project](https://pluto.vulmix.dev/docs/getting-started/create-a-project)
- [Why Pluto](https://pluto.vulmix.dev/docs/getting-started/why-pluto)
- [Contributing](https://pluto.vulmix.dev/docs/contributing/workspace)

## License

MIT

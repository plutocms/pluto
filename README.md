<img width="335" height="105" alt="Pluto" src="https://github.com/user-attachments/assets/1cf11470-ea54-416e-a940-7221fffef1e2" />

# Pluto

A layer-based CMS for [Nuxt](https://nuxt.com/). You add only the layers you need.

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
npm install @plutocms/pluto
```

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  extends: [['@plutocms/pluto', { install: true }]],
})
```

With no other layer, Pluto is a Markdown CMS on GitHub: posts are files in your repository, and
each save is a commit. See [GitHub CMS](https://pluto.vulmix.dev/github-cms/quickstart).

## Layers

| Package | What it adds |
|---|---|
| `@plutocms/pluto` | The core: the admin, the content model, and the GitHub CMS. |
| `@plutocms/nuxt-content` | A visual editor for the pages of a Nuxt Content site. |
| `@plutocms/supabase` | A Supabase backend: database, auth, users, and roles. |
| `@plutocms/supabase-blog` | Blog posts on Supabase. |
| `@plutocms/supabase-shop` | Products on Supabase. |
| `@plutocms/supabase-storage` | Media uploads on Supabase Storage. |

Read [Layers](https://pluto.vulmix.dev/core/layers) to see how they fit together.

## Links

- [Create a project](https://pluto.vulmix.dev/getting-started/create-a-project)
- [Why Pluto](https://pluto.vulmix.dev/getting-started/why-pluto)
- [Contributing](https://pluto.vulmix.dev/contributing/workspace)

## License

MIT

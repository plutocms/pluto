# Docs layer for Pluto

Edit the Markdown pages of a [Nuxt Content](https://content.nuxt.com) site in the Pluto admin,
with a visual block editor and a live preview. The pages stay Markdown files in your GitHub
repository, and each save is a commit.

**Docs:** [Docs layer](https://pluto.vulmix.dev/docs/layers/docs) ·
[Edit pages visually](https://pluto.vulmix.dev/docs/guides/edit-pages-visually)

## Install

```bash
npm install @plutocms/docs
```

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  extends: ['@plutocms/docs'],

  plutoDocs: {
    types: [{ preset: 'docs', name: 'doc', source: '' }],
  },
})
```

The layer brings `@plutocms/core`. It needs Node 22.5 or newer. The docs show the rest of the
setup: the collections, the CSS entry, `PlutoRoot`, and the GitHub App.

## What you get

- A `docs` page type for nested, numbered Markdown pages.
- A visual block editor with a live preview, and a Markdown mode.
- Your own components in the palette: call `definePlutoBlock({ label, icon })` in a component of `components/content/`. The props and slots come from its TypeScript types.
- Hybrid render mode (default): a save shows on the site at once, with no wait for a build. Build and runtime modes are options.
- "New Page" and "Edit Page" in the admin bar, and an "Edit in admin" link for the public page.
- The pages on the public API of Pluto (`/api/pluto/v1/content/<type>`), for a site in any stack.

## License

MIT

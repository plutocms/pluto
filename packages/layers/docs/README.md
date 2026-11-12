# Docs layer for Pluto

Edit the Markdown pages of a [Nuxt Content](https://content.nuxt.com) site in the Pluto admin,
with a visual block editor and a live preview. The pages stay Markdown files in your GitHub
repository, and each save is a commit.

**Docs:** [Docs layer](https://pluto.vulmix.dev/docs/layers/docs) ·
[Edit pages visually](https://pluto.vulmix.dev/docs/extend/edit-pages-visually)

## Install

```bash
npm install @plutocms/docs
```

An existing Nuxt Content site, such as [Docus](https://docus.dev), needs one line:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  extends: ['docus', '@plutocms/docs'],
})
```

The layer reads the page collections of the site and makes one content type for each. It leaves
the site as it is, adds the admin at `/admin`, and shows the admin bar to signed-in editors.

The layer brings `@plutocms/core`. It needs Node 22.5 or newer. The docs show how to choose the
types yourself (`plutoDocs.types`), the render modes, and the GitHub App.

## What you get

- A `docs` page type for nested, numbered Markdown pages.
- A visual block editor with a live preview, and a Markdown mode.
- Your own components in the palette: call `definePlutoBlock({ label, icon })` in a component of `components/content/`. The props and slots come from its TypeScript types.
- Hybrid render mode (default): a save shows on the site at once, with no wait for a build. Build and runtime modes are options.
- "New Page" and "Edit Page" in the admin bar, and an "Edit in admin" link for the public page.
- The pages on the public API of Pluto (`/api/pluto/v1/content/<type>`), for a site in any stack.

## License

MIT

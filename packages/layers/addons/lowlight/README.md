# @plutocms/lowlight

An add-on layer for [Pluto](https://pluto.vulmix.dev) sites, for every backend (Git CMS or
Supabase), on a server or on a static site. It colors the code blocks of the posts with
[lowlight](https://github.com/wooorm/lowlight), the grammars of highlight.js.

- **On the server:** the public API returns the code blocks already colored (`hljs-*` classes). A
  page needs no JavaScript for it, and a static build colors the code when it builds.
- **About 35 languages** (the `common` set of highlight.js), with their short names: `ts`, `sh`,
  `yml`, `py`. A block in another language, or with no language, stays plain.
- **The preview of the post editor** shows the same colors.

Core has no highlighter: without this layer (or another highlighter), a code block is plain.

## Install

```bash
npm install @plutocms/lowlight
```

Add it next to the backend layer of your app. It does not bring Pluto: the app or the backend
layer does. It needs `@plutocms/core` 0.68.0 or newer.

```ts [nuxt.config.ts]
export default defineNuxtConfig({
  extends: ['@plutocms/core', '@plutocms/lowlight'],
})
```

## The theme

The colors are an opt-in stylesheet. Import it in the CSS of your site, after Tailwind if the site
has it:

```css [app/assets/css/main.css]
@import '@plutocms/lowlight/theme.css';
```

It colors the code of `.pluto-prose` (the post body of `PlutoHtml`), light by default and dark under
a `.dark` ancestor. Change the colors with the variables:

```css
.pluto-prose {
  --pluto-code-keyword: #d73a49;
  --pluto-code-string: #032f62;
  --pluto-code-number: #005cc5;
  --pluto-code-function: #6f42c1;
  --pluto-code-type: #22863a;
  --pluto-code-property: #e36209;
  --pluto-code-comment: #6a737d;
}
```

Or skip the theme, and style the `hljs-*` classes with any highlight.js theme.

## With other highlighters

The layer registers the highlighter `lowlight` with `definePlutoHighlighter` of core. A site can
have more than one: set the one to try first in the runtime config, and the others follow:

```ts [nuxt.config.ts]
export default defineNuxtConfig({
  runtimeConfig: {
    plutoApi: { highlighter: 'lowlight' }, // env: NUXT_PLUTO_API_HIGHLIGHTER
  },
})
```

See [Code highlighting](https://pluto.vulmix.dev/docs/extend/code-highlighting) for Shiki and for
writing your own.

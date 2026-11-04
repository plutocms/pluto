# A plain ColorModeButton, formatPublishedDate, and PlutoImage classes

The blog template had its own `ColorModeSwitch` and a `postDate` util. Core's `ColorModeButton`
was a Nuxt UI navbar control (admin look), so a site could not style it. The user asked to use
core's button with Tailwind classes, and whether `postDate` can be a core utility.

## Checklist

- [x] `ColorModeButton`: one `<button class="pluto-color-mode-button">` with a `UIcon` (1em), in
      `ClientOnly` (no fallback slot, so the placeholder `<span>` takes the caller's class). Look in
      `pluto-base.css`. Public component test.
- [x] The admin navbar keeps its look: `PlutoAdminColorModeButton` (a `PlutoNavbarHit`).
- [x] `formatPublishedDate(item, options)`: `publishedAt`, else `createdAt`; `'en'`, UTC,
      `dateStyle: 'medium'` by default (no hydration mismatch). Test.
- [x] `PlutoImage` has one root (a `v-if` chain): a class on it reaches the image (it was a
      fragment, and the class was lost).
- [x] Skills (public-components, content-model, admin-shell), FEATURES.md, docs.
- [x] Live check on the blog template with local core: light, dark, the cover image classes.

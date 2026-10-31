# 3D add-on

`@plutocms/3d` (`packages/layers/addons/3d`) is the first **add-on layer**: a layer that adds a
feature on top of core, for any backend. It lives in the core repo, a Bun monorepo: core is
`packages/core` and the add-ons are in `packages/layers/addons/*`. It adds 3D models (`.glb`) to the media library of core (see the media skill).

## Files

- `nuxt.config.ts`: `plutoMedia.extraTypes: ['model/gltf-binary']` and
  `typeLimits: { 'model/gltf-binary': 25 MB }`. No `extends`: the backend layer of the app brings
  core, so core loads once.
- `app/plugins/pluto-3d.ts`: the media kind `model` (`accept`, `label: '3d.kind'`, `icon`,
  `badge: '3D'`, `viewer`, `createPreview`, `inspect`). It imports no three.js.
- `app/lib/pluto-3d.ts`: three.js, imported on demand in the browser only. `createStage`
  (renderer, soft studio light with `RoomEnvironment`, a key light on the camera, ACES at
  exposure 0.8), `loadModel` (GLTFLoader with the Meshopt decoder), `frameModel` (a
  three-quarter view that fits the model), `disposeObject`, `renderModelPreview` (one frame,
  1024 px, WebP or PNG, transparent).
- `app/lib/pluto-3d-math.ts`: `fitDistance` (pure, tested).
- `app/lib/pluto-3d-glb.ts`: `glbExternalFiles`, the files a `.glb` links but does not hold (reads
  the JSON chunk only; tested).
- `app/components/Pluto3dViewer.vue`: the viewer (record or `src`, `autoRotate`, `interactive`).
  The preview image shows while it loads. Rendering stops off screen (`IntersectionObserver`);
  the GPU memory goes on unmount.
- `app/components/Pluto3dPreview.vue`: the preview image with a 3D badge; with `interactive`, a
  click starts the viewer in its place.
- `i18n/locales/*.json`: the `3d.*` texts. A key can start with a digit (`isMessageKey`).
- `app/composables/pluto-3d-i18n.ts`: `usePluto3dI18n()`. The components follow the admin language
  under `/admin`, and the site language (`usePlutoSiteI18n`) on a site page.
- The repo playground (`playground/` at the root) extends core and the add-on. `bun run dev` at the
  root runs it, and the typecheck of the add-on uses it. Do not upload files in it with the GitHub
  CMS: the local Git commits go into the core repo.

## The monorepo setup

- The root `package.json` has `workspaces`: `packages/core`, `packages/layers/addons/*` and `playground`. The
  root scripts (`dev`, `build`, `typecheck`, `test`) call the packages. `typecheck` and `test`
  run core first and then the add-on. `bunfig.toml` keeps the hoisted `node_modules`: with
  the isolated layout, the Nuxt module loader on Windows did not find the dependencies of a
  module (`@nuxt/image` lost `ufo`).
- The peer dependency on `@plutocms/core` (`>=0.38.0 <1.0.0`) is optional, so Bun does not
  install a second core from npm next to the workspace source.
- The add-on has its own `typecheck` (`nuxt prepare` of the playground and `vue-tsc`) and `test`
  (`vitest run`) scripts.
- release-please (`release-please-config.json`): `separate-pull-requests`. The package
  `packages/core` (`@plutocms/core`) has `include-component-in-tag: false`, so its tags have no
  component. The add-on `packages/layers/addons/3d` has `component: '3d'`,
  `include-component-in-tag: true`, `initial-version: '0.1.0'` and its own tags (`3d-v0.1.0`).
  `.release-please-manifest.json` holds one version for each path. The shared `release.yml`
  publishes every path that release-please released. `scripts/release.sh pluto @plutocms/3d <ver>
packages/layers/addons/3d` releases it. The script is in the workspace, one folder above this
  repo.
- npm: a trusted publisher for each package (repo `plutocms/pluto`, `release.yml`). The first
  publish of a new package is by hand.

## Use in a template

The shop template uses the add-on. It extends `plutoLayer('@plutocms/3d')` next to the backend
layer, and the product gallery shows `Pluto3dViewer` for a 3D model.

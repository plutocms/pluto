# 3D add-on

`@plutocms/3d` (`packages/layers/addons/3d`) is the first **add-on layer**: a layer that adds a
feature on top of core, for any backend. It lives in the core repo as the trial of the future
monorepo. It adds 3D models (`.glb`) to the media library of core (see the media skill).

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
- `.playground/`: core (the repo root) and the add-on, for `nuxt dev` and the typecheck. Do not
  upload files in it with the GitHub CMS: the local Git commits go into the core repo.

## The monorepo setup

- The root `package.json` has `workspaces`. `bunfig.toml` keeps the hoisted `node_modules`: with
  the isolated layout, the Nuxt module loader on Windows did not find the dependencies of a
  module (`@nuxt/image` lost `ufo`).
- The peer dependency on `@plutocms/pluto` is optional, so Bun does not install a second core
  from npm next to the root source.
- Core's `.npmignore` has `packages`. Core's `typecheck` script runs the typecheck of the add-on
  (its playground). The root `vitest run` runs the tests of the add-on too.
- release-please: `separate-pull-requests`, `.` excludes `packages`, the add-on has
  `component: '3d'` and its own tags (`3d-v0.1.0`). The shared `release.yml` publishes every
  path that release-please released. `scripts/release.sh pluto @plutocms/3d <ver>
  packages/layers/addons/3d` releases it.
- npm: a trusted publisher for each package (repo `plutocms/pluto`, `release.yml`). The first
  publish of a new package is by hand.

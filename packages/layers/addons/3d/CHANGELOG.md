# Changelog

## [0.3.0](https://github.com/plutocms/pluto/compare/3d-v0.2.1...3d-v0.3.0) (2026-11-01)


### ⚠ BREAKING CHANGES

* the GitHub CMS is the Git CMS, and plutoLayer returns the source only ([#330](https://github.com/plutocms/pluto/issues/330))

### Features

* the GitHub CMS is the Git CMS, and plutoLayer returns the source only ([#330](https://github.com/plutocms/pluto/issues/330)) ([2aaedfe](https://github.com/plutocms/pluto/commit/2aaedfe32ad25e5e246994a998b0bfab32b63285))

## [0.2.1](https://github.com/plutocms/pluto/compare/3d-v0.2.0...3d-v0.2.1) (2026-10-30)


### Bug Fixes

* **3d:** the viewer follows the site language on a site page ([#291](https://github.com/plutocms/pluto/issues/291)) ([34887ae](https://github.com/plutocms/pluto/commit/34887aedf2d85496d2f1711b73157aabb653f6cf))

## [0.2.0](https://github.com/plutocms/pluto/compare/3d-v0.1.0...3d-v0.2.0) (2026-10-30)


### ⚠ BREAKING CHANGES

* the package @plutocms/pluto is now @plutocms/core, and @plutocms/pluto/layers is @plutocms/core/layers. PLUTO_PLUTO_PATH is now PLUTO_CORE_PATH.

### Features

* core is @plutocms/core, in packages/core ([#280](https://github.com/plutocms/pluto/issues/280)) ([6b18054](https://github.com/plutocms/pluto/commit/6b18054bb945f3a0695fb35851cd8aa1ed2e6d03))

## 0.1.0 (2026-10-30)


### ⚠ BREAKING CHANGES

* model/gltf-binary is no longer an allowed type by default; a layer adds it with runtimeConfig.public.plutoMedia.extraTypes (the 3D add-on). A media record has a preview field, and a media driver needs setPreview.

### Features

* the 3D add-on layer, in a monorepo setup ([#274](https://github.com/plutocms/pluto/issues/274)) ([30215ca](https://github.com/plutocms/pluto/commit/30215cae0923614ad194e4a0e2517c5252c34985))

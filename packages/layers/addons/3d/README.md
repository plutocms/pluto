# @plutocms/3d

An add-on layer for [Pluto](https://pluto.vulmix.dev). It adds 3D models (`.glb`) to the media
library of Pluto, for every backend (GitHub CMS or Supabase):

- **Upload:** the media library takes `.glb` files, up to 25 MB each.
- **Preview image:** at upload, the browser renders a static preview of the model (1024 px, WebP).
  A site shows it as the thumbnail, with no 3D code. "Make a preview" in the details of a file
  makes one for an older model.
- **Viewer:** the details of a model in the admin show it in 3D. A site uses the same viewer.
- **Check:** a model that links files it does not hold (outside textures) gets a warning at upload.

three.js loads on demand, in the browser only, on the pages that show a model.

## Install

```bash
npm install @plutocms/3d
```

Add it next to the backend layer of your app. It does not bring Pluto: the backend layer does.

```ts [nuxt.config.ts]
export default defineNuxtConfig({
  extends: ['@plutocms/supabase-shop', '@plutocms/3d'],
})
```

## Show a model on a site

The public API gives a `media` field as media records. A model has `mimeType:
'model/gltf-binary'` and a `preview` image.

```vue
<!-- The preview image, and "View in 3D" starts the viewer. -->
<Pluto3dPreview :media="model" class="aspect-square" />

<!-- The viewer at once: drag to turn, scroll or pinch to zoom. -->
<Pluto3dViewer :media="model" auto-rotate class="aspect-square" />
```

| Component        | Props                                                                                |
| ---------------- | ------------------------------------------------------------------------------------ |
| `Pluto3dViewer`  | `media` or `src`, `alt`, `autoRotate`, `interactive` (false: no drag and no zoom)    |
| `Pluto3dPreview` | `media`, `sizes` (of the image), `interactive` (false: the image only), `autoRotate` |

Without `@plutocms/3d`, `PlutoImage` of core shows the preview image of a model too.

## Limits

- `.glb` only (one file with its textures). A `.gltf` with separate files is not supported.
- Meshopt compression works. Draco compression does not (it needs a decoder file).

## License

MIT

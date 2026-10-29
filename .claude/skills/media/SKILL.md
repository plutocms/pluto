# Media

Core owns the media library of every Pluto app: the record, the upload checks, the routes, the
Media page, the `media` field widget, the picker and `PlutoImage`. A backend gives only a
**driver**. It stores the bytes and the record. Every layer that stores files uses this library,
so the admin has one media gallery for every backend.

The design and its trade-offs are in `.claude/plan/core-media.md` of the workspace.

## Files

- `shared/types/media.ts`: `PlutoMedia` (the record), `PlutoPublicMedia`, `PlutoMediaQuery`,
  `PlutoMediaUpload`, `PlutoMediaPatch`, `PlutoMediaDriver`, `PlutoMediaLimits`.
- `shared/utils/media.ts`: the defaults (`PLUTO_MEDIA_DEFAULT_TYPES`, 10 MB, 2400 px),
  `resolveMediaLimits`, `matchesMediaType`, `mediaKind`, `isMediaImage`, `mediaExtension`,
  `mediaTypeFromName`, `mediaAcceptAttribute`, `mediaFileName`, `filterMediaRecords`,
  `mediaFieldIds`, `formatMediaSize`.
- `server/utils/pluto-media-bytes.ts`: `sniffMediaType`, `readImageSize` (`image-meta`),
  `stripImageMetadata`. Pure JS.
- `server/utils/pluto-media-driver.ts`: `registerMediaDriver`, `getMediaDriver`,
  `requireMediaDriver`.
- `server/utils/pluto-media.ts`: `prepareMediaUpload`, `parseMediaQuery`, and the route
  handlers.
- `server/utils/pluto-media-public.ts`: `expandPublicMedia`, for the public API.
- `server/utils/pluto-media-config.ts`: `getMediaLimits` (the only reader of the runtime config).
- `server/api/_pluto/media/`: `GET`, `POST`, `PATCH /:id`, `DELETE /:id`, `POST /sizes`.
- `app/utils/pluto-media-image.ts`: `processMediaImage` (the browser processing),
  `PlutoMediaDecodeError`.
- `app/composables/pluto-media.ts`: `usePlutoMedia()`, `PlutoMediaUploadProblem`.
- `app/components/Pluto/Media/`: `PlutoMediaLibrary`, `PlutoMediaTile`, `PlutoMediaDetails`,
  `PlutoMediaPicker`, `PlutoMediaEditorButton`.
- `app/components/Pluto/Content/fields/PlutoFieldMedia.vue`: the `media` widget.
- `app/components/Pluto/PlutoImage.vue`: an image on a public page.
- `app/pages/admin/media.vue`: the Media page.
- `modules/pluto-github/runtime/server/media.ts`: the GitHub driver.
- `modules/pluto-github/runtime/server/routes/media.get.ts`: the `/media/**` route.

## The record

```ts
interface PlutoMedia {
  id: string; url: string; name: string; mimeType: string; size: number
  width: number | null; height: number | null; alt: string; createdAt: string
}
```

Core fills in the record from the bytes, on the server. A driver must not fill in a field
itself:

- `mimeType`: from the magic bytes (`sniffMediaType`), not from the browser or the name.
- `size`: the size after the metadata is removed.
- `width` and `height`: from the image header. `null` for a file that is not an image.
- `name`: the original file name, for people. The stored file has a unique name:
  `mediaFileName` gives the slug of the name, five random characters and the extension of the
  real type (`pao-de-mel-k3j9a.webp`).

## An upload

1. **The browser** (`usePlutoMedia().upload`):
   - checks the type and the size (for the user only);
   - processes an image with `processMediaImage`;
   - sends `file` and `alt` as multipart.
2. **`processMediaImage`**:
   - `createImageBitmap` with `imageOrientation: 'from-image'`, so the EXIF rotation is applied;
   - a canvas copies no metadata;
   - the long edge becomes at most 2400 px;
   - the result is WebP at 0.82, or JPEG at 0.85 when the browser cannot write WebP;
   - GIF and files that are not images stay as they are;
   - when no resize is needed and the result is not smaller, it keeps the original. The server
     then removes its metadata.
   - A HEIC that the browser cannot read throws `PlutoMediaDecodeError`.
3. **The server** (`prepareMediaUpload`):
   - checks the size (413), the real type against `allowedTypes` (415), and that the file is
     not empty (400);
   - removes the metadata at the byte level (`stripImageMetadata`): JPEG APP1 (EXIF, XMP),
     APP13 and comments, PNG `eXIf` and the text chunks, WebP `EXIF` and `XMP`. A JPEG keeps
     only its rotation, in a minimal EXIF block;
   - reads the pixels and makes the record;
   - then calls `driver.upload`.

The rules are `runtimeConfig.public.plutoMedia`: `allowedTypes` (empty gives the defaults: JPEG,
PNG, WebP, AVIF, GIF, `model/gltf-binary`, PDF; no SVG) and `maxUploadBytes` (`0` gives 10 MB).
A `media` field can narrow the types with `accept`.

## The driver

```ts
interface PlutoMediaDriver {
  name: string
  authorize(event, capability: 'media:manage' | 'media:delete'): Promise<void>
  list(event, query): Promise<{ data: PlutoMedia[]; total: number }>
  get(event, ids): Promise<PlutoMedia[]>
  upload(event, input: PlutoMediaUpload): Promise<PlutoMedia>
  update(event, id, patch): Promise<PlutoMedia>
  remove(event, id): Promise<void>
}
```

- A backend registers one driver on the server (`registerMediaDriver`, the last one wins). It
  sets `runtimeConfig.public.plutoMedia.driver` (for example `'github'`). Without that value,
  the admin shows no Media page and no image buttons.
- `authorize` is required. Unlike the content adapter, a media write never fails open. Core
  calls it before every admin read (`media:manage`) and every write (`media:manage`, or
  `media:delete` for a delete).
- `get` must work with no caller: the public API uses it.
- `list` gives the newest first. A driver that reads all its records at once can use
  `filterMediaRecords`.
- `upload` stores the bytes and the record together. When the record fails, the driver removes
  the bytes.

Core declares the capabilities `media:manage` and `media:delete`.

## The GitHub driver

- **The file:** `public/media/<yyyy>/<mm>/<file>`, served at `/media/<yyyy>/<mm>/<file>`.
- **The record:** `<content dir>/media/<id>.md`, frontmatter only (`name`, `file`, `url`,
  `mimeType`, `size`, `width`, `height`, `alt`, `createdAt`). The id is the stored file name
  without the extension.
- **One commit** (`media: add <file>`) holds both. A delete removes both in one commit. A
  conflict with an unrelated commit tries again (two times).
- **The store:** an addition can be binary (`encoding: 'base64'`). `readRaw(path)` gives the
  bytes (GitHub: the raw contents API).
- **The `/media/**` route** reads a file from the repo. After a deploy the host sends the
  static file first, so the route answers only for a file that is not in a deploy yet. A content
  commit can skip the deploy. The stored name never changes, so the answer is `immutable`. The
  route takes only `<yyyy>/<mm>/<safe name>`.
- **Capabilities:** a user with push access gets `media:manage` and `media:delete`. Admin and
  maintain have `*`.

Only one size of each image is in the repo. Other sizes come at delivery.

## The public API

`expandPublicMedia` puts the records in place of the ids of every public `media` field: one
record (or `null`), or a list for `multiple`. One `driver.get` reads all the ids of one answer.
An id with no record (a deleted file) is dropped. A layer needs no `toPublic` hook for media.

## The admin

- **`/admin/media`:** a grid with search, a type filter, uploads (a button, or drop files on the
  grid), "Show more", and an aside with the details (alt text, copy the URL, open, delete with a
  confirmation). "Fill in missing image sizes" (`POST /api/_pluto/media/sizes`) reads the pixels
  of older images through their URL.
- **`PlutoFieldMedia`:** the core widget for `fieldType: 'media'`. One file: a tile with Change
  and Remove. `multiple`: a strip in order (move left, move right, remove) and an Add tile. The
  value is an id, or a list of ids. A deleted file shows as a "Deleted file" tile.
- **`PlutoMediaPicker`:** a modal with the library in select mode, and uploads. It emits
  `select` with the records.
- **`PlutoMediaEditorButton`:** the image button of a rich text toolbar (the `slot: 'image'`
  item of `usePlutoMarkdownToolbar({ image: true })`). It inserts `![alt](url)`.

## `PlutoImage`

```vue
<PlutoImage :media="post.cover" sizes="xs:100vw sm:50vw lg:400px" class="h-auto w-full" />
```

- It wraps `NuxtImg` (`@nuxt/image`, a core module) with the `width`, `height` and `alt` of the
  record, so the layout does not move while the image loads.
- The provider of the host makes the sizes: IPX on Node, the image service of Vercel or
  Netlify. On Cloudflare Workers there is no IPX: set `image.provider` to `cloudflare` or
  `none`.
- Give every entry of `sizes` a screen (`xs:100vw`). An entry with no screen gives a 1 px
  `srcset` entry.
- When the image service cannot read the file, `PlutoImage` shows the file as it is. A record
  that is not an image shows nothing.
- IPX reads only the public folders that exist when the dev server starts. A project with no
  `public/` folder before its first upload gets the plain file until a restart.

## Tests

- `test/media-bytes.test.ts`: the type sniffing and the metadata strip, with byte samples.
- `test/media-server.test.ts`: the shared helpers, `prepareMediaUpload`, and the public
  expansion.
- `test/github-media.test.ts`: the GitHub driver on the memory store, the route path check, and
  binary files in the `fs` and GitHub stores.

# The post preview gets the public shape, and `--pluto-page-height`

The user asked for a simpler `PlutoPostPreview` in the blog template, with core helpers where they
help, and other DX wins.

## Checklist

- [x] `toPreviewItem` / `previewMediaIds` (shared): the form item in the shape of the public API
      (`html`, `createdAt` / `updatedAt` / `publishedAt` from the type, media records). Tests.
- [x] `/_pluto/post-preview` reads the media records once per id and passes `item` (a
      `PlutoPreviewItem`) and `contentType`. No `html` prop: it is in `item`. Breaking for an app
      preview component; the blog template moves with it.
- [x] `--pluto-page-height` on `PlutoRoot` (`:where`, both rules), so a layout needs no script.
- [x] Live check on the test app (local core): the preview shows the date, the cover and the body;
      the layout is the viewport less the bar.
- [x] Skills, FEATURES.md, docs (editing: the preview).

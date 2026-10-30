/** Sets or replaces the preview image of a file (multipart `preview`). Needs `media:manage`. */
export default defineEventHandler((event) =>
  setMediaPreview(event, getRouterParam(event, 'id') ?? '')
)

/** Deletes a file and its record. Needs `media:delete`. */
export default defineEventHandler((event) =>
  removeMedia(event, getRouterParam(event, 'id') ?? '')
)

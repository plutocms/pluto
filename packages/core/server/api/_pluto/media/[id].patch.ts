/** Changes the alt text of a file. Needs `media:manage`. */
export default defineEventHandler((event) =>
  updateMedia(event, getRouterParam(event, 'id') ?? '')
)

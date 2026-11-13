export default defineEventHandler((event) =>
  removeMedia(event, getRouterParam(event, 'id') ?? '')
)

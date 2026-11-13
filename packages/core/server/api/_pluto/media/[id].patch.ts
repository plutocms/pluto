export default defineEventHandler((event) =>
  updateMedia(event, getRouterParam(event, 'id') ?? '')
)

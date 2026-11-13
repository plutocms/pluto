export default defineEventHandler((event) =>
  setMediaPreview(event, getRouterParam(event, 'id') ?? '')
)

import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  if (!event.context.params?.id) {
    throw createError({ message: 'No id provided.' })
  }

  const id = Number.parseInt(event.context.params?.id)

  const client = await serverSupabaseClient<Database>(event)

  const { data, error } = await client.from('products').delete().eq('id', id)

  if (error) {
    throw createError({ statusMessage: error.message })
  }

  return {
    message: 'Product deleted successfully.',
    statusCode: 200,
    data,
  }
})

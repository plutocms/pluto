import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const client = await serverSupabaseClient<Database>(event)

  const { data, error } = await client
    .from('availability')
    .select('id, label, slug')
    .order('id', { ascending: true })

  if (error) {
    throw createError({ statusMessage: error.message })
  }
  return { data }
})

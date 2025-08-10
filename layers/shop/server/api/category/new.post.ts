import type { Database } from '#shared/types/supabase'
import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const client = await serverSupabaseClient<Database>(event)

  const body = await readBody(event)

  if (!body) {
    throw createError({
      message: 'No file sent.',
    })
  }

  const { data, error } = await client.from('categories').insert(body).select()

  if (error) {
    throw createError({
      message: error.message,
    })
  }

  if (error) {
    throw createError({ message: 'error' })
  }

  return { data }
})

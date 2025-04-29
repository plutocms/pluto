import { serverSupabaseClient } from '#supabase/server'
import type { Database } from '~~/types/supabase'

export default defineEventHandler(async event => {
  const client = await serverSupabaseClient<Database>(event)

  const { data, error } = await client.from('media').select('*')

  if (error) {
    throw createError({
      message: 'error',
    })
  }

  return { data }
})

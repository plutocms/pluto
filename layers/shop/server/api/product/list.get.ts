import type { Database } from '#shared/types/supabase'
import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const client = await serverSupabaseClient<Database>(event)

  const { data, error } = await client
    .from('products')
    .select('*, media(*)')
    .order('created_at', { ascending: false })

  if (error) {
    throw createError({ statusMessage: error.message })
  }

  return { data }
})

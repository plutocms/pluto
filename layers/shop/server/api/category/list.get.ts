import type { Database } from '#shared/types/supabase'
import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const client = await serverSupabaseClient<Database>(event)

  const { data } = await client.from('categories').select('*')

  return { data }
})

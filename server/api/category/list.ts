import { serverSupabaseClient } from '#supabase/server'
import type { Database } from '~~/types/supabase'

export default defineEventHandler(async event => {
  const client = await serverSupabaseClient<Database>(event)

  const { data } = await client.from('categories').select('*')

  return { data }
})

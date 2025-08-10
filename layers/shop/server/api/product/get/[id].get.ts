import type { Database } from '#shared/types/supabase'
import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const params = event.context.params
  const client = await serverSupabaseClient<Database>(event)

  if (params) {
    const { data, error } = await client
      .from('products')
      .select('*, media(*)')
      .eq('id', Number(params?.id))
      .limit(1)
      .single()

    if (error) {
      throw createError({ statusMessage: error.message })
    }

    return { data }
  }
})

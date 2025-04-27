import { serverSupabaseClient } from '#supabase/server'
import type { Database } from '~~/types/supabase'

export default defineEventHandler(async event => {
  const params = event.context.params
  const client = await serverSupabaseClient<Database>(event)

  if (params) {
    const { data, error } = await client
      .from('products')
      .select('*, media(*)')
      .eq('slug', params?.slug)
      .limit(1)
      .single()

    if (error) {
      throw createError({ statusMessage: error.message })
    }

    return { data }
  }
})

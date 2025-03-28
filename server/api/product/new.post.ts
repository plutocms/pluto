import { serverSupabaseClient } from '#supabase/server'
import type { Database } from '~~/types/supabase'

type FormBody = Database['public']['Tables']['products']['Insert']

export default defineEventHandler(async event => {
  const client = await serverSupabaseClient<Database>(event)
  const body = await readBody<FormBody>(event)

  const { error } = await client.from('products').insert(body)

  if (error) {
    throw createError({ statusMessage: error.message })
  }

  return {
    message: 'Product created successfully',
    statusCode: 200,
  }
})

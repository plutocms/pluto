import { serverSupabaseClient } from '#supabase/server'
import type { Database } from '~~/types/supabase'

export default defineEventHandler(async event => {
  const client = await serverSupabaseClient<Database>(event)

  const { data, error } = await client.storage.from('media').list('uploads', {
    limit: 100,
    offset: 0,
    sortBy: { column: 'name', order: 'asc' },
  })

  if (error) {
    createError({
      message: 'error',
    })
  } else {
    return {
      data,
    }
  }
})

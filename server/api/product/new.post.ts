import { serverSupabaseClient } from '#supabase/server'
import type { Database } from '~~/types/supabase'

type Media = Database['public']['Tables']['media']['Row']
type FormBody = Database['public']['Tables']['products']['Insert'] & {
  media: Media[]
}

export default defineEventHandler(async event => {
  const client = await serverSupabaseClient<Database>(event)
  const body = await readBody<FormBody>(event)

  if (!body) throw createError({ statusMessage: 'No payload sent.' })

  const { media: _, ...bodyWithoutMedia } = body
  const payload: Omit<FormBody, 'media'> = {
    ...bodyWithoutMedia,
    created_at: new Date().toISOString(),
  }

  const { error } = await client.from('products').insert(payload).select()

  if (error) {
    throw createError({ statusMessage: error.message })
  }

  const { error: mediaError } = await client
    .from('media')
    .insert(body.media)
    .select()

  if (mediaError) {
    throw createError({ statusMessage: mediaError.message })
  }

  return {
    message: 'Product created successfully',
    statusCode: 200,
    data: body,
  }
})

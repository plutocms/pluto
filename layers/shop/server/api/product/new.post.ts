import type { Database } from '#shared/types/supabase'
import { serverSupabaseClient } from '#supabase/server'

type Media = Database['public']['Tables']['media']['Row']
type FormBody = Database['public']['Tables']['products']['Insert'] & {
  media: Media[]
}

export default defineEventHandler(async (event) => {
  const client = await serverSupabaseClient<Database>(event)
  const body = await readBody<FormBody>(event)

  if (!body) {
    throw createError({ statusMessage: 'No payload sent.' })
  }

  const { media: _, ...bodyWithoutMedia } = body

  const payload: Omit<FormBody, 'media'> = {
    ...bodyWithoutMedia,
    created_at: new Date().toISOString(),
  }

  const { data, error } = await client
    .from('products')
    .insert(payload)
    .select()
    .single()

  if (error) {
    throw createError({ statusMessage: error.message })
  }

  const mediaPayload = body.media.map((media) => ({
    ...media,
    product_id: data.id,
  }))

  const { error: mediaError } = await client
    .from('media')
    .upsert(mediaPayload, { onConflict: 'id' })
    .select()

  if (mediaError) {
    throw createError({ statusMessage: mediaError.message })
  }

  return {
    message: 'Product created successfully',
    statusCode: 200,
    data: {
      id: data.id,
      ...body,
    },
  }
})

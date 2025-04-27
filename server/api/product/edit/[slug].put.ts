import { serverSupabaseClient } from '#supabase/server'
import type { Database } from '~~/types/supabase'

type Media = Database['public']['Tables']['media']['Row']
type FormBody = Database['public']['Tables']['products']['Insert'] & {
  media: Media[]
}

export default defineEventHandler(async event => {
  const client = await serverSupabaseClient<Database>(event)
  const params = event.context.params
  const body = await readBody<FormBody>(event)

  if (!body) throw createError({ statusMessage: 'No payload sent.' })

  if (!params) throw createError({ statusMessage: 'No param sent.' })

  const { media: _, ...bodyWithoutMedia } = body

  const payload: Omit<FormBody, 'media'> = {
    ...bodyWithoutMedia,
    created_at: new Date().toISOString(),
  }

  const { error } = await client
    .from('products')
    .update(payload)
    .eq('slug', params.slug)
    .select()
    .maybeSingle()

  if (error) {
    throw createError({ statusMessage: error.message })
  }

  const mediaPayload = body.media.map(media => ({
    ...media,
    product_id: body.id,
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
    data: body,
  }
})

import { serverSupabaseClient } from '#supabase/server'

type Media = Database['public']['Tables']['media']['Row']
type FormBody = Database['public']['Tables']['products']['Insert'] & {
  media: Media[]
  removedMediaIds?: number[]
}

export default defineEventHandler(async (event) => {
  const client = await serverSupabaseClient<Database>(event)
  const params = event.context.params
  const body = await readBody<FormBody>(event)

  if (!body) {
    throw createError({ statusMessage: 'No payload sent.' })
  }

  if (!params) {
    throw createError({ statusMessage: 'No param sent.' })
  }

  const { media: _, removedMediaIds = [], ...bodyWithoutMedia } = body

  const payload: Omit<FormBody, 'media' | 'removedMediaIds'> = {
    ...bodyWithoutMedia,
  }

  const { data, error } = await client
    .from('products')
    .update(payload)
    .eq('id', Number(body.id))
    .select('*')
    .single()

  if (error) {
    throw createError({ statusMessage: error.message })
  }

  const mediaPayload = body.media.map((media) => ({
    ...media,
    product_id: body.id,
  }))

  // Separate new media (no id) and existing media (with id)
  const newMedia = mediaPayload.filter((m) => !m.id)
  const existingMedia = mediaPayload.filter((m) => m.id)

  // Insert new media
  let insertedMedia: Media[] = []

  // Update removed media to set product_id to null
  if (removedMediaIds.length > 0) {
    const { error: removeError } = await client
      .from('media')
      .update({ product_id: null })
      .in('id', removedMediaIds)

    if (removeError) {
      throw createError({ statusMessage: removeError.message })
    }
  }

  // Upsert existing media
  if (existingMedia.length > 0) {
    for (const media of existingMedia) {
      // Check if this media is already used by another product
      const { data: existing, error: fetchError } = await client
        .from('media')
        .select('id,product_id')
        .eq('id', media.id)
        .single()

      if (fetchError) {
        throw createError({ statusMessage: fetchError.message })
      }

      if (existing && existing.product_id && existing.product_id !== body.id) {
        // Create a new entry if used by another product
        const { data: newMedia, error: insertError } = await client
          .from('media')
          .insert({ ...media, id: undefined, product_id: body.id })
          .select('*')
          .single()

        if (insertError) {
          throw createError({ statusMessage: insertError.message })
        }

        insertedMedia.push(newMedia as Media)
      } else if (existing && existing.product_id === body.id) {
        // Already on this product, do nothing
        continue
      } else {
        // Safe to upsert
        const { error: updateError } = await client
          .from('media')
          .upsert([media], { onConflict: 'id' })

        if (updateError) {
          throw createError({ statusMessage: updateError.message })
        }
      }
    }
  }

  // Insert new media
  if (newMedia.length > 0) {
    const { data: media, error: mediaError } = await client
      .from('media')
      .upsert(newMedia, { onConflict: 'id' })
      .select('*')

    if (mediaError) {
      throw createError({ statusMessage: mediaError.message })
    }

    insertedMedia = [...insertedMedia, ...media]
  }

  // Combine existing and newly inserted media for response
  // Only include existingMedia that actually belong to this product
  const filteredExistingMedia = existingMedia.filter(
    (m) => m.product_id === body.id
  )
  const media = [...filteredExistingMedia, ...insertedMedia]

  return {
    message: 'Product created successfully',
    statusCode: 200,
    data: { ...data, media },
  }
})

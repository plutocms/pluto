import type { Database } from '~~/types/supabase'
import { serverSupabaseClient } from '#supabase/server'
import { fileNameToKebabCase } from '~/utils/string'

export default defineEventHandler(async event => {
  const client = await serverSupabaseClient<Database>(event)

  const formData = await readMultipartFormData(event)

  if (!formData || !formData?.[0].filename)
    throw createError({
      message: 'No file sent.',
    })

  const fileName = fileNameToKebabCase(formData[0].filename)

  const { data: mediaUploadData, error: mediaUploadError } =
    await client.storage
      .from('media')
      .upload(`uploads/${fileName}`, formData[0].data, {
        contentType: formData[0].type,
        upsert: true,
      })

  if (mediaUploadError) {
    throw createError({
      message: 'error',
    })
  }

  const { error } = await client.from('media').insert({
    name: fileName,
    alt: formData[2].data.toString(),
    uid: mediaUploadData.id,
  })

  if (error) {
    throw createError({ message: 'error' })
  }

  return { mediaUploadData }
})

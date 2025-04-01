import type { Database } from '~~/types/supabase'
import { serverSupabaseClient } from '#supabase/server'
import { kebabCase } from 'change-case'

export default defineEventHandler(async event => {
  const client = await serverSupabaseClient<Database>(event)

  const formData = await readMultipartFormData(event)

  if (!formData || !formData?.[0].filename)
    throw createError({
      message: 'No file sent.',
    })

  const fileName = formData[0].filename.replace(/(.*)(\.\w+$)/, `$1`)
  const fileExtension = formData[0].filename.replace(/(.*)(\.\w+$)/, `$2`)

  const { data: mediaUploadData, error: mediaUploadError } =
    await client.storage
      .from('media')
      .upload(
        `uploads/${kebabCase(fileName)}${fileExtension}`,
        formData[0].data,
        {
          contentType: formData[0].type,
          upsert: true,
        }
      )

    createError({
  if (mediaUploadError) {
      message: 'error',
    })
  } else {
    return {
      data,
    }
  }
})

import type { Database } from '~~/types/supabase'
import { serverSupabaseClient } from '#supabase/server'
import { kebabCase } from 'change-case'

export default defineEventHandler(async event => {
  const client = await serverSupabaseClient<Database>(event)

  const formData = await readMultipartFormData(event)

  const year = new Date().getFullYear().toString()
  const month = Intl.NumberFormat('en-US', {
    minimumIntegerDigits: 2,
  }).format(new Date().getMonth() + 1)

  if (!formData || !formData?.[0].filename)
    throw createError({
      message: 'No file sent.',
    })

  const fileName = formData[0].filename.replace(/(.*)(\.\w+$)/, `$1`)
  const fileExtension = formData[0].filename.replace(/(.*)(\.\w+$)/, `$2`)

    .from('media')
    .upload(
      `uploads/${year}-${month}-${kebabCase(fileName)}${fileExtension}`,
      file[0].data,
      {
        contentType: file[0].type,
        upsert: true,
      }
    )
  const { data: mediaUploadData, error: mediaUploadError } =
    await client.storage

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

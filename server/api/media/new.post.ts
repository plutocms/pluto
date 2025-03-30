import type { Database } from '~~/types/supabase'
import { serverSupabaseClient } from '#supabase/server'
import { kebabCase } from 'change-case'

export default defineEventHandler(async event => {
  const client = await serverSupabaseClient<Database>(event)

  const file = await readMultipartFormData(event)

  const year = new Date().getFullYear().toString()
  const month = Intl.NumberFormat('en-US', {
    minimumIntegerDigits: 2,
  }).format(new Date().getMonth() + 1)

  if (!file || !file?.[0].filename)
    throw createError({
      message: 'No file sent.',
    })

  const fileName = file[0].filename.replace(/(.*)(\.\w+$)/, `$1`)
  const fileExtension = file[0].filename.replace(/(.*)(\.\w+$)/, `$2`)

  const { data, error } = await client.storage
    .from('media')
    .upload(
      `uploads/${year}-${month}-${kebabCase(fileName)}${fileExtension}`,
      file[0].data,
      {
        contentType: file[0].type,
        upsert: true,
      }
    )

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

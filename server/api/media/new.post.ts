//import { serverSupabaseClient } from '#supabase/server'
//import type { Database } from '~~/types/supabase'

export default defineEventHandler(async event => {
  //const client = await serverSupabaseClient<Database>(event)

  const file = await readMultipartFormData(event)

  if (!file) throw createError('An error occurred')

  console.log({ file: file })

  /* const { data, error } = await client.storage
    .from('bucket_name')
    .upload('file_path', file)
  if (error) {
    createError({
      message: 'error',
    })
  } else {
    return {
      data,
    }
  } */
})

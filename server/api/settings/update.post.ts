import type { Database } from '#shared/types/supabase'
import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  type SettingName =
    Database['public']['Tables']['settings']['Insert']['setting_name']
  type FormBody = Record<SettingName, string>

  const client = await serverSupabaseClient<Database>(event)
  const body = await readBody<FormBody>(event)

  if (!body) {
    throw createError({ statusMessage: 'No payload sent.' })
  }

  const transformed = [
    ...Object.entries(body).map(([key, value]) => ({
      setting_name: key as SettingName,
      setting_value: value,
    })),
  ]

  const { data, error } = await client
    .from('settings')
    .upsert(transformed, { onConflict: 'setting_name' })
    .select()

  if (error) {
    throw createError({ statusMessage: error.message })
  }

  return {
    message: 'Settings updated successfully.',
    statusCode: 200,
    data,
  }
})

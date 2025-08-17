import type { Database } from '#shared/types/supabase'
import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const client = await serverSupabaseClient<Database>(event)

  const { data } = await client.from('settings').select('*')

  type SettingsKey =
    Database['public']['Tables']['settings']['Row']['setting_name']

  // @ts-expect-error: Object.fromEntries may not infer the correct type for settings
  const settings: Record<SettingsKey, string> = {
    ...Object.fromEntries(
      data?.map((item) => [item.setting_name, item.setting_value]) || []
    ),
  }

  data?.forEach((item) => {
    if (!item.setting_name || !item.setting_value) {
      return
    }

    settings[item.setting_name] = item.setting_value
  })

  return { settings }
})

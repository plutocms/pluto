import type { Database } from '#shared/types/supabase'
import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const client = await serverSupabaseClient<Database>(event)

  const body = await readBody(event)

  await client.auth.signUp({
    email: body.email,
    password: body.password,
    options: {
      data: {
        first_name: body.first_name,
        last_name: body.last_name,
        is_admin: false,
      },
    },
  })

  return { message: 'User registered successfully' }
})

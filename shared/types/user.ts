import type { Database } from '#shared/types/supabase'

export type User = Database['public']['Tables']['profiles']['Row']

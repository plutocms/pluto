import type { Database } from '#layers/supabase/shared/types/supabase'

export type SupabaseDatabase = Database
export type User = Database['public']['Tables']['profiles']['Row']

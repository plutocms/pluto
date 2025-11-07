export type Media = SupabaseDatabase['public']['Tables']['media']['Row']
export type Product = SupabaseDatabase['public']['Tables']['products']['Row']

export interface ProductWithMedia extends Product {
  media: Media[]
}

export type CartItem = ProductItem

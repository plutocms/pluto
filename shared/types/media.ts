export interface PlutoMediaItem {
  id: string
  name: string
  url: string
  mimeType?: string
  size?: number
  alt?: string
}

export interface PlutoMediaListOptions {
  limit?: number
  offset?: number
  search?: string
}

/**
 * Lets a storage layer (Supabase Storage, S3, R2, local disk...) plug into
 * one shared media picker UI and one `media` field widget, without core
 * knowing which backend is in use. Exactly one adapter is registered per
 * app — see the `mediaAdapters` registry bucket, which keeps only the
 * last-registered one, the same "last wins" rule as `settingsDrivers`.
 */
export interface PlutoMediaAdapter {
  id: string
  list: (options: PlutoMediaListOptions) => Promise<{
    data: PlutoMediaItem[]
    total?: number
  }>
  upload: (file: File, meta?: {
    alt?: string
  }) => Promise<PlutoMediaItem>
  remove: (id: string) => Promise<void>
  getUrl: (id: string) => string
}

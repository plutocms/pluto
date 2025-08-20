export function useMedia() {
  const config = useRuntimeConfig()

  function getMediaUrl(fileName: string | null | undefined): string {
    if (!fileName) {
      return ''
    }

    return `${config.public.supabase.url}/storage/v1/object/public/media/uploads/${fileName}`
  }

  return { getMediaUrl }
}

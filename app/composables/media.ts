export function useMedia() {
  const config = useRuntimeConfig()

  function getMediaUrl(fileName: string): string {
    return `${config.public.supabase.url}/storage/v1/object/public/media/uploads/${fileName}`
  }

  return { getMediaUrl }
}

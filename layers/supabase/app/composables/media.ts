export function useMedia() {
  const config = useRuntimeConfig()

  const {
    data: mediaList,
    refresh: refreshMediaList,
    status: mediaStatus,
  } = useFetch('/api/media/list', {
    key: '/api/media/list',
  })

  function getMediaUrl(fileName: string | null | undefined): string {
    if (!fileName) {
      return ''
    }

    return `${config.public.supabase.url}/storage/v1/object/public/media/uploads/${fileName}`
  }

  return { mediaList, refreshMediaList, mediaStatus, getMediaUrl }
}

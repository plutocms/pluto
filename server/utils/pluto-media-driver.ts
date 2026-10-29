import type { PlutoMediaDriver } from '../../shared/types/media'
import { createPlutoError } from './pluto-error'

// The media driver of the app. A backend registers one (GitHub, Supabase,
// ...). A module-scope singleton, like the content registry
// (server/utils/pluto-content.ts), for the same reasons: it is set once at
// startup and holds no per-request state. See the media skill.

let mediaDriver: PlutoMediaDriver | undefined

/** Replaces the driver that was registered before. The last one wins. */
export function registerMediaDriver(driver: PlutoMediaDriver): void {
  mediaDriver = driver
}

export function getMediaDriver(): PlutoMediaDriver | undefined {
  return mediaDriver
}

export function requireMediaDriver(): PlutoMediaDriver {
  if (!mediaDriver) {
    throw createPlutoError({
      statusCode: 404,
      message: 'No media storage is set up.',
      key: 'pluto.media.errors.noDriver',
    })
  }
  return mediaDriver
}

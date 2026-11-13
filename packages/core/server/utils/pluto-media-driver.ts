import type { PlutoMediaDriver } from '../../shared/types/media'
import { createPlutoError } from './pluto-error'

let mediaDriver: PlutoMediaDriver | undefined

/**
 * Registers the media driver, the storage of the uploaded files. The last driver registered wins.
 *
 * @see https://pluto.vulmix.dev/docs/build/media#write-a-driver
 */
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

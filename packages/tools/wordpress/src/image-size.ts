import type { Settings } from './values'
import { lengthOf, numberOf, text } from './values'

const IMAGE_SIZES: Record<string, number> = {
  thumbnail: 150,
  medium: 300,
  medium_large: 768,
  large: 1024,
}

/**
 * The width of an image widget: its own width, else the pixel width of its WordPress size
 * (`thumbnail`, `medium`, `medium_large`, `large`). The size `full` gives no width.
 * @see https://developer.wordpress.org/apis/handbook/media/image-sizes/
 */
export function imageWidth(settings: Settings): string | undefined {
  const explicit = lengthOf(settings.width)

  if (explicit) {
    return explicit
  }

  const size = text(settings.image_size)

  if (size === 'custom') {
    const custom = numberOf(
      (settings.image_custom_dimension as { width?: unknown } | undefined)
        ?.width
    )

    return custom ? `${custom}px` : undefined
  }

  const px = size ? IMAGE_SIZES[size] : undefined

  return px ? `${px}px` : undefined
}

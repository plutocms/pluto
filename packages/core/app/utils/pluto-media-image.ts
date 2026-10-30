
/** The image types the browser processes before an upload. GIF is not in it: it can move. */
const PROCESSED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/bmp',
  'image/heic',
  'image/heif',
])

/** The browser could not read the image (for example HEIC outside Safari). */
export class PlutoMediaDecodeError extends Error {
  constructor(readonly fileName: string) {
    super(`The browser cannot read "${fileName}".`)
    this.name = 'PlutoMediaDecodeError'
  }
}

type Canvas = HTMLCanvasElement | OffscreenCanvas

function makeCanvas(width: number, height: number): Canvas {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height)
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function encode(canvas: Canvas, type: string, quality: number): Promise<Blob> {
  if ('convertToBlob' in canvas) {
    return canvas.convertToBlob({ type, quality })
  }
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('No image.'))),
      type,
      quality
    )
  )
}

/**
 * Makes a photo ready for the library, in the browser, before the upload:
 *
 * - the EXIF rotation is applied, then the canvas copies no metadata (EXIF,
 *   the GPS place, XMP);
 * - the long edge is at most `maxEdge` pixels (2400);
 * - WebP, or JPEG when the browser cannot write WebP.
 *
 * It returns the file as it is when it is not an image to process (a GIF, a
 * 3D model, a PDF), or when processing gives no smaller file and no resize
 * is needed (the server removes the metadata of that file). The same code
 * runs for every backend and host. See the media skill.
 */
export async function processMediaImage(
  file: File,
  options: {
    maxEdge?: number
    quality?: number
  } = {}
): Promise<File> {
  const maxEdge = options.maxEdge ?? PLUTO_MEDIA_MAX_IMAGE_EDGE
  const quality = options.quality ?? 0.82
  if (
    !PROCESSED_TYPES.has(file.type) ||
    typeof createImageBitmap === 'undefined'
  ) {
    return file
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new PlutoMediaDecodeError(file.name)
  }

  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = makeCanvas(width, height)
  const context = canvas.getContext('2d') as
    CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null
  if (!context) {
    bitmap.close()
    return file
  }
  context.imageSmoothingQuality = 'high'
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  // A browser that cannot write WebP gives PNG. Then use JPEG.
  let blob = await encode(canvas, 'image/webp', quality)
  if (blob.type !== 'image/webp') {
    blob = await encode(canvas, 'image/jpeg', 0.85)
  }
  if (scale === 1 && blob.size >= file.size && file.type !== 'image/bmp') {
    return file
  }
  const extension = blob.type === 'image/webp' ? 'webp' : 'jpg'
  const name = `${file.name.replace(/\.[^.]+$/, '') || 'image'}.${extension}`
  return new File([blob], name, { type: blob.type, lastModified: Date.now() })
}

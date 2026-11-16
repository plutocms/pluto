import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { imageMeta } from 'image-meta'
import { readIfExists, serializeMarkdownFile, writeFileDeep } from './files'

export const MEDIA_INDEX = 'pluto-import/media.json'

export const MAX_IMAGE_BYTES = 20 * 1024 * 1024

export interface MediaOptions {
  root: string
  fetch: typeof fetch
  now: () => Date
  timeoutMs?: number
  maxBytes?: number
  concurrency?: number
}

export interface MediaFailure {
  url: string
  reason: string
}

export interface MediaResult {
  map: Map<string, string>
  downloaded: number
  reused: number
  failures: MediaFailure[]
}

interface IndexEntry {
  id: string
  url: string
}

type MediaIndex = Record<string, IndexEntry>

const TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.slice(start, end))
}

/** The image type from the first bytes of a file, not from its name or its headers. */
export function sniffImageType(bytes: Uint8Array): string | undefined {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }

  if (ascii(bytes, 1, 4) === 'PNG') {
    return 'image/png'
  }

  if (ascii(bytes, 0, 4) === 'GIF8') {
    return 'image/gif'
  }

  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') {
    return 'image/webp'
  }

  if (ascii(bytes, 4, 8) === 'ftyp' && /^avi[fs]$/.test(ascii(bytes, 8, 12))) {
    return 'image/avif'
  }

  return undefined
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function nameOf(url: string): string {
  try {
    const last = new URL(url).pathname.split('/').pop() ?? ''

    return decodeURIComponent(last) || 'file'
  } catch {
    return 'file'
  }
}

/** The stored name, like the media library of core: a slug, a short suffix and the extension. */
export function mediaFileName(name: string, mimeType: string, suffix: string) {
  const stem = slugify(name.replace(/\.[^./\\]+$/, '')).slice(0, 60)

  return `${stem || 'file'}-${suffix}.${TYPES[mimeType] ?? 'bin'}`
}

async function readBody(
  response: Response,
  maxBytes: number
): Promise<Uint8Array> {
  const declared = Number(response.headers.get('content-length'))

  if (declared > maxBytes) {
    throw new Error(`the file is larger than ${maxBytes / 1024 / 1024} MB`)
  }

  if (!response.body) {
    return new Uint8Array(await response.arrayBuffer())
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0

  for (;;) {
    const { done, value } = await reader.read()

    if (done) {
      break
    }

    total += value.length

    if (total > maxBytes) {
      await reader.cancel()

      throw new Error(`the file is larger than ${maxBytes / 1024 / 1024} MB`)
    }

    chunks.push(value)
  }

  const bytes = new Uint8Array(total)
  let offset = 0

  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }

  return bytes
}

async function download(
  url: string,
  options: MediaOptions
): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 15000)

  try {
    const response = await options.fetch(url, {
      signal: controller.signal,
      headers: { 'user-agent': 'pluto-wordpress' },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const type = (response.headers.get('content-type') ?? '')
      .split(';')[0]!
      .trim()
      .toLowerCase()

    if (!type.startsWith('image/')) {
      throw new Error(`the content type is ${type || 'missing'}, not an image`)
    }

    const bytes = await readBody(response, options.maxBytes ?? MAX_IMAGE_BYTES)
    const mimeType = sniffImageType(bytes)

    if (!mimeType) {
      throw new Error(
        type === 'image/svg+xml'
          ? 'SVG is not an allowed type of the media library'
          : 'the file is not a JPEG, PNG, WebP, AVIF or GIF image'
      )
    }

    return { bytes, mimeType }
  } finally {
    clearTimeout(timer)
  }
}

function describe(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error)
  }

  if (error.name === 'AbortError') {
    return 'the request timed out'
  }

  const code = (error.cause as { code?: unknown } | undefined)?.code

  return typeof code === 'string' ? `${error.message} (${code})` : error.message
}

async function readIndex(root: string): Promise<MediaIndex> {
  const source = await readIfExists(join(root, MEDIA_INDEX))

  if (!source) {
    return {}
  }

  try {
    return JSON.parse(source) as MediaIndex
  } catch {
    return {}
  }
}

async function store(
  url: string,
  alt: string,
  data: { bytes: Uint8Array; mimeType: string },
  options: MediaOptions
): Promise<IndexEntry> {
  const createdAt = options.now()
  const suffix = createHash('sha1').update(url).digest('hex').slice(0, 5)
  const name = nameOf(url)
  const file = mediaFileName(name, data.mimeType, suffix)
  const id = file.replace(/\.[^.]+$/, '')
  const month = `${createdAt.getUTCFullYear()}/${String(createdAt.getUTCMonth() + 1).padStart(2, '0')}`
  const path = `public/media/${month}/${file}`
  const publicUrl = `/media/${month}/${file}`
  let size: { width?: number; height?: number } = {}

  try {
    size = imageMeta(data.bytes)
  } catch {
    size = {}
  }

  const record = serializeMarkdownFile(
    {
      name,
      file: path,
      url: publicUrl,
      mimeType: data.mimeType,
      size: data.bytes.length,
      width: size.width,
      height: size.height,
      alt: alt || undefined,
      createdAt: createdAt.toISOString(),
    },
    ''
  )

  await writeFileDeep(join(options.root, path), data.bytes)
  await writeFileDeep(join(options.root, 'content/media', `${id}.md`), record)

  return { id, url: publicUrl }
}

/**
 * Downloads the images of the pages into `public/media/<yyyy>/<mm>/`, with a record in
 * `content/media/`, like the media driver of the Git CMS. An image that is already imported from
 * the same URL is reused. An image that fails keeps its remote URL.
 */
export async function importMedia(
  images: Map<string, string>,
  options: MediaOptions
): Promise<MediaResult> {
  const index = await readIndex(options.root)
  const result: MediaResult = {
    map: new Map(),
    downloaded: 0,
    reused: 0,
    failures: [],
  }
  const queue = [...images.entries()]
  const hosts = new Map<string, number>()
  let changed = false

  async function handle(url: string, alt: string) {
    const known = index[url]

    if (
      known &&
      (await readIfExists(
        join(options.root, 'content/media', `${known.id}.md`)
      ))
    ) {
      result.map.set(url, known.url)
      result.reused++

      return
    }

    const host = new URL(url).host

    if ((hosts.get(host) ?? 0) >= 2) {
      result.failures.push({ url, reason: `the host ${host} did not answer` })

      return
    }

    try {
      const data = await download(url, options)
      const entry = await store(url, alt, data, options)

      index[url] = entry
      changed = true
      result.map.set(url, entry.url)
      result.downloaded++
    } catch (error) {
      const network =
        error instanceof Error &&
        (error.name === 'AbortError' || error.name === 'TypeError')

      if (network) {
        hosts.set(host, (hosts.get(host) ?? 0) + 1)
      }

      const reason = describe(error)

      result.failures.push({ url, reason })
    }
  }

  async function worker() {
    for (let entry = queue.shift(); entry; entry = queue.shift()) {
      await handle(entry[0], entry[1])
    }
  }

  await Promise.all(
    Array.from({ length: options.concurrency ?? 4 }, () => worker())
  )

  if (changed) {
    await writeFileDeep(
      join(options.root, MEDIA_INDEX),
      `${JSON.stringify(index, null, 2)}\n`
    )
  }

  return result
}

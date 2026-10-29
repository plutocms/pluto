import type { H3Event } from 'h3'
import type {
  PlutoMedia,
  PlutoMediaCapability,
  PlutoMediaDriver,
  PlutoMediaPatch,
} from '../../../../shared/types/media'
import type { PlutoGithubAccess } from './adapter'
import type {
  PlutoGithubCommitInput,
  PlutoGithubFile,
  PlutoGithubStore,
} from './store/types'
import { Buffer } from 'node:buffer'
import { createPlutoError } from '../../../../server/utils/pluto-error'
import { filterMediaRecords } from '../../../../shared/utils/media'
import { isPlutoGithubConflictError } from './store/errors'
import { parseMarkdownFile, serializeMarkdownFile } from './utils/markdown-file'

/** The URL prefix of the media files. The files are in `<publicDir>/media/`. */
export const GITHUB_MEDIA_URL_PREFIX = '/media'

/** An id: the stored file name without its extension. No dots or slashes. */
const ID = /^[a-z0-9][a-z0-9-]{0,99}$/

export interface GithubMediaDriverOptions {
  store: PlutoGithubStore
  /** The content dir. The records are in `<dir>/media/<id>.md`. */
  dir: string
  /** The public dir of the site, relative to the repo root. Default `public`. */
  publicDir?: string
  getAccess: (event: H3Event) => Promise<PlutoGithubAccess | null>
  /** Adds `[skip ci]` to the commit message, like the content commits. */
  skipDeploy?: boolean
  /** How many times a commit tries again after an unrelated commit. Default 2. */
  retries?: number
}

interface MediaFrontmatter {
  name?: unknown
  file?: unknown
  url?: unknown
  mimeType?: unknown
  size?: unknown
  width?: unknown
  height?: unknown
  alt?: unknown
  createdAt?: unknown
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * The media driver of the GitHub CMS. A file and its record go into the repo
 * in one commit:
 *
 * - the file: `public/media/<yyyy>/<mm>/<name>-<suffix>.<ext>`, served at
 *   `/media/<yyyy>/<mm>/...` (a static file after a deploy; before it, the
 *   `/media/**` route reads it from the repo);
 * - the record: `<dir>/media/<id>.md`, frontmatter only.
 *
 * Only one size of each image is stored: other sizes come at delivery
 * (`@nuxt/image`). See the media skill.
 */
export function createGithubMediaDriver(
  options: GithubMediaDriverOptions
): PlutoMediaDriver {
  const { store } = options
  const recordDir = `${options.dir.replace(/\/+$/, '')}/media`
  const publicDir = (options.publicDir ?? 'public').replace(/\/+$/, '')
  const skipSuffix = options.skipDeploy ? ' [skip ci]' : ''
  const retries = options.retries ?? 2

  const recordPath = (id: string) => `${recordDir}/${id}.md`

  function requireId(id: string): string {
    if (!ID.test(id)) {
      throw createPlutoError({
        statusCode: 404,
        message: 'The file does not exist.',
        key: 'pluto.media.errors.notFound',
      })
    }
    return id
  }

  function toRecord(file: PlutoGithubFile): PlutoMedia | null {
    let data: MediaFrontmatter
    try {
      data = parseMarkdownFile(file.text).frontmatter as MediaFrontmatter
    } catch {
      return null
    }
    if (typeof data.url !== 'string' || typeof data.mimeType !== 'string') {
      return null
    }
    return {
      id: file.name.replace(/\.md$/, ''),
      url: data.url,
      name: typeof data.name === 'string' ? data.name : file.name,
      mimeType: data.mimeType,
      size: numberOrNull(data.size) ?? 0,
      width: numberOrNull(data.width),
      height: numberOrNull(data.height),
      alt: typeof data.alt === 'string' ? data.alt : '',
      createdAt: typeof data.createdAt === 'string' ? data.createdAt : '',
    }
  }

  function serialize(record: PlutoMedia, file: string): string {
    return serializeMarkdownFile(
      {
        name: record.name,
        file,
        url: record.url,
        mimeType: record.mimeType,
        size: record.size,
        width: record.width ?? undefined,
        height: record.height ?? undefined,
        alt: record.alt || undefined,
        createdAt: record.createdAt,
      },
      ''
    )
  }

  async function requireAccess(event: H3Event): Promise<PlutoGithubAccess> {
    const access = await options.getAccess(event)
    if (!access) {
      throw createPlutoError({
        statusCode: 401,
        message: 'Sign in first.',
        key: 'pluto.github.errors.signInRequired',
      })
    }
    return access
  }

  async function readAll(event: H3Event): Promise<PlutoMedia[]> {
    const access = await options.getAccess(event).catch(() => null)
    const head = await store.head({ auth: access?.auth })
    const files = await store.listDir(recordDir, head, access?.auth)
    return files
      .map(toRecord)
      .filter((record): record is PlutoMedia => record !== null)
  }

  async function readOne(
    event: H3Event,
    id: string,
    access: PlutoGithubAccess
  ): Promise<{ record: PlutoMedia; file: string }> {
    const head = await store.head({ revalidate: true, auth: access.auth })
    const found = await store.readFile(
      recordPath(requireId(id)),
      head,
      access.auth
    )
    const record = found ? toRecord(found) : null
    if (!found || !record) {
      throw createPlutoError({
        statusCode: 404,
        message: 'The file does not exist.',
        key: 'pluto.media.errors.notFound',
      })
    }
    const data = parseMarkdownFile(found.text).frontmatter as MediaFrontmatter
    return { record, file: typeof data.file === 'string' ? data.file : '' }
  }

  /** Commits on the newest head. A new head from an unrelated commit tries again. */
  async function commit(
    access: PlutoGithubAccess,
    input: Omit<PlutoGithubCommitInput, 'expectedHeadOid'>
  ): Promise<void> {
    for (let attempt = 0; ; attempt++) {
      const head = await store.head({ revalidate: true, auth: access.auth })
      try {
        await store.commit({ ...input, expectedHeadOid: head }, access.auth)
        return
      } catch (error) {
        if (!isPlutoGithubConflictError(error) || attempt >= retries) {
          throw error
        }
      }
    }
  }

  return {
    name: 'github',

    async authorize(event: H3Event, capability: PlutoMediaCapability) {
      const access = await requireAccess(event)
      if (
        !access.capabilities.includes('*') &&
        !access.capabilities.includes(capability)
      ) {
        throw createPlutoError({
          statusCode: 403,
          message: 'You do not have permission to change the media library.',
          key: 'pluto.media.errors.noPermission',
        })
      }
    },

    async list(event, query) {
      return filterMediaRecords(await readAll(event), query)
    },

    async get(event, ids) {
      const wanted = new Set(ids)
      return (await readAll(event)).filter((record) => wanted.has(record.id))
    },

    async upload(event, input) {
      const access = await requireAccess(event)
      const date = new Date(input.createdAt)
      const month = `${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, '0')}`
      const id = input.fileName.replace(/\.[^.]+$/, '')
      const file = `${publicDir}/media/${month}/${input.fileName}`
      const record: PlutoMedia = {
        id: requireId(id),
        url: `${GITHUB_MEDIA_URL_PREFIX}/${month}/${input.fileName}`,
        name: input.name,
        mimeType: input.mimeType,
        size: input.size,
        width: input.width,
        height: input.height,
        alt: input.alt,
        createdAt: input.createdAt,
      }
      await commit(access, {
        message: `media: add ${input.fileName}${skipSuffix}`,
        additions: [
          {
            path: file,
            contents: Buffer.from(input.data).toString('base64'),
            encoding: 'base64',
          },
          { path: recordPath(id), contents: serialize(record, file) },
        ],
        deletions: [],
      })
      return record
    },

    async update(event, id, patch: PlutoMediaPatch) {
      const access = await requireAccess(event)
      const { record, file } = await readOne(event, id, access)
      const next: PlutoMedia = {
        ...record,
        ...(patch.alt !== undefined ? { alt: patch.alt } : {}),
        ...(patch.width !== undefined ? { width: patch.width } : {}),
        ...(patch.height !== undefined ? { height: patch.height } : {}),
      }
      await commit(access, {
        message: `media: update ${id}${skipSuffix}`,
        additions: [{ path: recordPath(id), contents: serialize(next, file) }],
        deletions: [],
      })
      return next
    },

    async remove(event, id) {
      const access = await requireAccess(event)
      const { file } = await readOne(event, id, access)
      await commit(access, {
        message: `media: delete ${id}${skipSuffix}`,
        additions: [],
        deletions: [
          { path: recordPath(id) },
          ...(file.startsWith(`${publicDir}/media/`) ? [{ path: file }] : []),
        ],
      })
    },
  }
}

const CONTENT_TYPES: Record<string, string> = {
  avif: 'image/avif',
  gif: 'image/gif',
  glb: 'model/gltf-binary',
  jpg: 'image/jpeg',
  pdf: 'application/pdf',
  png: 'image/png',
  webp: 'image/webp',
}

/** A media path from the URL (`2026/10/name.webp`), or `null` when it is not one. */
export function githubMediaPath(path: string): string | null {
  const parts = path.split('/')
  return parts.length === 3 &&
    /^\d{4}$/.test(parts[0] ?? '') &&
    /^\d{2}$/.test(parts[1] ?? '') &&
    /^[a-z0-9][a-z0-9-]*\.[a-z0-9]+$/.test(parts[2] ?? '')
    ? path
    : null
}

/** The type to send for a media file, from its extension. */
export function githubMediaContentType(path: string): string {
  return (
    CONTENT_TYPES[path.slice(path.lastIndexOf('.') + 1)] ??
    'application/octet-stream'
  )
}

import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseMarkdownFile } from '../src/files'
import { importMedia, mediaFileName, sniffImageType } from '../src/media'
import { PNG } from './fixtures'

const NOW = new Date('2026-11-16T10:00:00Z')

let root: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'pluto-wordpress-media-'))
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

function fakeFetch(
  handler: (url: string) => Response | Promise<Response>,
  calls: string[] = []
): typeof fetch {
  return ((input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)

    calls.push(url)

    return Promise.resolve(
      init?.signal?.aborted
        ? Promise.reject(new Error('aborted'))
        : handler(url)
    )
  }) as typeof fetch
}

function image(bytes: Uint8Array = PNG, type = 'image/png'): Response {
  return new Response(bytes, { headers: { 'content-type': type } })
}

const URL_A =
  'https://old.example.test/wp-content/uploads/2024/01/Hero Image.png'

describe('importMedia', () => {
  it('writes the file and the record like the media driver of the Git CMS', async () => {
    const result = await importMedia(new Map([[URL_A, 'A hero']]), {
      root,
      fetch: fakeFetch(() => image()),
      now: () => NOW,
    })
    const url = result.map.get(URL_A)!

    expect(url).toMatch(/^\/media\/2026\/11\/hero-image-[0-9a-f]{5}\.png$/)
    expect(result.downloaded).toBe(1)

    const file = join(root, 'public', url)
    const bytes = new Uint8Array(await readFile(file))

    expect(bytes).toEqual(PNG)

    const id = url.split('/').pop()!.replace('.png', '')

    expect(id).toMatch(/^[a-z0-9][a-z0-9-]{0,99}$/)

    const record = parseMarkdownFile(
      await readFile(join(root, 'content/media', `${id}.md`), 'utf8')
    )

    expect(record.frontmatter).toEqual({
      name: 'Hero Image.png',
      file: `public${url}`,
      url,
      mimeType: 'image/png',
      size: PNG.length,
      width: 1,
      height: 1,
      alt: 'A hero',
      createdAt: '2026-11-16T10:00:00.000Z',
    })
    expect(record.body).toBe('')
  })

  it('leaves alt out of the record when the image has none', async () => {
    const result = await importMedia(new Map([[URL_A, '']]), {
      root,
      fetch: fakeFetch(() => image()),
      now: () => NOW,
    })
    const id = result.map.get(URL_A)!.split('/').pop()!.replace('.png', '')
    const record = parseMarkdownFile(
      await readFile(join(root, 'content/media', `${id}.md`), 'utf8')
    )

    expect(record.frontmatter).not.toHaveProperty('alt')
  })

  it('reuses a file that is already imported from the same URL', async () => {
    const calls: string[] = []
    const options = {
      root,
      fetch: fakeFetch(() => image(), calls),
      now: () => NOW,
    }
    const first = await importMedia(new Map([[URL_A, '']]), options)
    const second = await importMedia(new Map([[URL_A, '']]), options)

    expect(calls).toHaveLength(1)
    expect(second.reused).toBe(1)
    expect(second.downloaded).toBe(0)
    expect(second.map.get(URL_A)).toBe(first.map.get(URL_A))
    expect(await readdir(join(root, 'content/media'))).toHaveLength(1)
  })

  it('downloads again when the record of an imported file is gone', async () => {
    const calls: string[] = []
    const options = {
      root,
      fetch: fakeFetch(() => image(), calls),
      now: () => NOW,
    }
    const first = await importMedia(new Map([[URL_A, '']]), options)
    const id = first.map.get(URL_A)!.split('/').pop()!.replace('.png', '')

    await rm(join(root, 'content/media', `${id}.md`))
    await importMedia(new Map([[URL_A, '']]), options)

    expect(calls).toHaveLength(2)
  })

  it('refuses a response that is not an image', async () => {
    const result = await importMedia(new Map([[URL_A, '']]), {
      root,
      fetch: fakeFetch(
        () =>
          new Response('<html>', { headers: { 'content-type': 'text/html' } })
      ),
      now: () => NOW,
    })

    expect(result.map.size).toBe(0)
    expect(result.failures[0]!.reason).toContain('not an image')
  })

  it('refuses a file whose bytes are not an image, whatever the header says', async () => {
    const result = await importMedia(new Map([[URL_A, '']]), {
      root,
      fetch: fakeFetch(() => image(new TextEncoder().encode('hello world!!'))),
      now: () => NOW,
    })

    expect(result.failures[0]!.reason).toContain(
      'not a JPEG, PNG, WebP, AVIF or GIF'
    )
  })

  it('refuses an SVG, which the media library does not allow', async () => {
    const result = await importMedia(new Map([[URL_A, '']]), {
      root,
      fetch: fakeFetch(() =>
        image(new TextEncoder().encode('<svg/>'), 'image/svg+xml')
      ),
      now: () => NOW,
    })

    expect(result.failures[0]!.reason).toContain('SVG')
  })

  it('refuses a file that is over the size limit, by header and by bytes', async () => {
    const byHeader = await importMedia(new Map([[URL_A, '']]), {
      root,
      maxBytes: 10,
      fetch: fakeFetch(
        () =>
          new Response(PNG, {
            headers: { 'content-type': 'image/png', 'content-length': '5000' },
          })
      ),
      now: () => NOW,
    })
    const byBytes = await importMedia(new Map([[`${URL_A}?b`, '']]), {
      root,
      maxBytes: 10,
      fetch: fakeFetch(() => image()),
      now: () => NOW,
    })

    expect(byHeader.failures[0]!.reason).toContain('larger than')
    expect(byBytes.failures[0]!.reason).toContain('larger than')
    await expect(readdir(join(root, 'public'))).rejects.toThrow()
  })

  it('reports an HTTP error and a timeout, and keeps no file', async () => {
    const http = await importMedia(new Map([[URL_A, '']]), {
      root,
      fetch: fakeFetch(() => new Response('', { status: 404 })),
      now: () => NOW,
    })
    const slow = await importMedia(new Map([['https://slow.test/a.png', '']]), {
      root,
      timeoutMs: 20,
      fetch: ((_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const error = new Error('aborted')

            error.name = 'AbortError'
            reject(error)
          })
        })) as typeof fetch,
      now: () => NOW,
    })

    expect(http.failures[0]!.reason).toBe('HTTP 404')
    expect(slow.failures[0]!.reason).toBe('the request timed out')
  })

  it('stops asking a host that does not answer', async () => {
    const calls: string[] = []
    const urls = new Map(
      [1, 2, 3, 4, 5].map((n) => [`https://down.test/${n}.png`, ''] as const)
    )
    const result = await importMedia(urls, {
      root,
      concurrency: 1,
      fetch: ((url: string) => {
        calls.push(url)

        return Promise.reject(new TypeError('fetch failed'))
      }) as typeof fetch,
      now: () => NOW,
    })

    expect(calls).toHaveLength(2)
    expect(result.failures).toHaveLength(5)
    expect(result.failures[4]!.reason).toContain('did not answer')
  })
})

describe('sniffImageType and mediaFileName', () => {
  it('reads the type from the bytes', () => {
    expect(sniffImageType(PNG)).toBe('image/png')
    expect(sniffImageType(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe(
      'image/jpeg'
    )
    expect(sniffImageType(new TextEncoder().encode('GIF89a'))).toBe('image/gif')
    expect(sniffImageType(new TextEncoder().encode('RIFF....WEBPVP8 '))).toBe(
      'image/webp'
    )
    expect(sniffImageType(new TextEncoder().encode('nope'))).toBeUndefined()
  })

  it('makes a stored name like the media library', () => {
    expect(mediaFileName('Pão de Mel.JPG', 'image/jpeg', 'k3j9a')).toBe(
      'pao-de-mel-k3j9a.jpg'
    )
    expect(mediaFileName('!!!.png', 'image/png', 'abcde')).toBe(
      'file-abcde.png'
    )
  })
})

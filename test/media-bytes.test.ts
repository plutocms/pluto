import { describe, expect, it } from 'vitest'
import {
  readImageSize,
  sniffMediaType,
  stripImageMetadata,
} from '../server/utils/pluto-media-bytes'

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(
    parts.flatMap((part) =>
      typeof part === 'string'
        ? [...part].map((char) => char.charCodeAt(0))
        : part
    )
  )

const has = (data: Uint8Array, text: string) =>
  new TextDecoder('latin1').decode(data).includes(text)

function segment(marker: number, body: number[] | string): number[] {
  const data = [...bytes(body)]
  const length = data.length + 2
  return [0xff, marker, length >> 8, length & 0xff, ...data]
}

/** An APP1 EXIF segment with an orientation tag and a GPS-like text. */
function exifSegment(orientation: number): number[] {
  const tiff = [
    0x4d,
    0x4d,
    0x00,
    0x2a,
    0x00,
    0x00,
    0x00,
    0x08,
    0x00,
    0x01,
    0x01,
    0x12,
    0x00,
    0x03,
    0x00,
    0x00,
    0x00,
    0x01,
    0x00,
    orientation,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
  ]
  return segment(0xe1, [
    ...bytes('Exif\0\0'),
    ...tiff,
    ...bytes('GPS-23.55,-46.63'),
  ])
}

/** A small JPEG: SOI, EXIF, IPTC, a comment, a color profile, a frame of 640 x 480, a scan, EOI. */
function jpeg(orientation = 1): Uint8Array {
  return new Uint8Array([
    0xff,
    0xd8,
    ...exifSegment(orientation),
    ...segment(0xed, 'Photoshop 3.0 IPTC author'),
    ...segment(0xfe, 'a comment'),
    ...segment(0xe2, 'ICC_PROFILE'),
    ...segment(
      0xc0,
      [8, 0x01, 0xe0, 0x02, 0x80, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]
    ),
    ...segment(0xda, [3, 1, 0, 2, 0x11, 3, 0x11, 0, 0x3f, 0]),
    0x12,
    0x34,
    0x56,
    0xff,
    0xd9,
  ])
}

function pngChunk(type: string, data: number[]): number[] {
  const length = data.length
  return [0, 0, length >> 8, length & 0xff, ...bytes(type), ...data, 0, 0, 0, 0]
}

function png(): Uint8Array {
  return new Uint8Array([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    ...pngChunk('IHDR', [0, 0, 1, 0, 0, 0, 0, 200, 8, 6, 0, 0, 0]),
    ...pngChunk('tEXt', [...bytes('Author\0Someone')]),
    ...pngChunk('eXIf', [...bytes('GPS-23.55')]),
    ...pngChunk('IDAT', [1, 2, 3]),
    ...pngChunk('IEND', []),
  ])
}

function webpChunk(name: string, data: number[]): number[] {
  const length = data.length
  const pad = length % 2 ? [0] : []
  return [
    ...bytes(name),
    length & 0xff,
    (length >> 8) & 0xff,
    0,
    0,
    ...data,
    ...pad,
  ]
}

function webp(): Uint8Array {
  // VP8X: flags (EXIF 0x08, XMP 0x04), 3 reserved, width - 1 and height - 1 (24 bit).
  const body = [
    ...bytes('WEBP'),
    ...webpChunk('VP8X', [0x0c, 0, 0, 0, 0x1f, 0x03, 0, 0xdf, 0x01, 0]),
    ...webpChunk('VP8 ', [1, 2, 3, 4]),
    ...webpChunk('EXIF', [...bytes('GPS-23.55')]),
    ...webpChunk('XMP ', [...bytes('<x:xmpmeta/>')]),
  ]
  const size = body.length
  return new Uint8Array([
    ...bytes('RIFF'),
    size & 0xff,
    (size >> 8) & 0xff,
    (size >> 16) & 0xff,
    0,
    ...body,
  ])
}

describe('sniffMediaType', () => {
  it('reads the type from the first bytes', () => {
    expect(sniffMediaType(jpeg())).toBe('image/jpeg')
    expect(sniffMediaType(png())).toBe('image/png')
    expect(sniffMediaType(webp())).toBe('image/webp')
    expect(sniffMediaType(bytes('GIF89a', [1, 0, 1, 0]))).toBe('image/gif')
    expect(
      sniffMediaType(bytes([0, 0, 0, 0x1c], 'ftypavif', [0, 0, 0, 0], 'mif1'))
    ).toBe('image/avif')
    expect(sniffMediaType(bytes('glTF', [2, 0, 0, 0]))).toBe(
      'model/gltf-binary'
    )
    expect(sniffMediaType(bytes('%PDF-1.7'))).toBe('application/pdf')
  })

  it('does not trust a name: an SVG, an HTML page or plain text has no known type', () => {
    expect(
      sniffMediaType(bytes('<svg xmlns="http://www.w3.org/2000/svg"/>'))
    ).toBeNull()
    expect(sniffMediaType(bytes('<html><script>'))).toBeNull()
    expect(sniffMediaType(new Uint8Array())).toBeNull()
  })
})

describe('stripImageMetadata', () => {
  it('jPEG: removes EXIF (GPS), IPTC and comments, and keeps the color profile and the image', () => {
    const out = stripImageMetadata(jpeg(), 'image/jpeg')
    expect(has(out, 'GPS')).toBe(false)
    expect(has(out, 'IPTC')).toBe(false)
    expect(has(out, 'a comment')).toBe(false)
    expect(has(out, 'ICC_PROFILE')).toBe(true)
    expect([...out.slice(-5)]).toEqual([0x12, 0x34, 0x56, 0xff, 0xd9])
    expect(readImageSize(out)).toEqual({ width: 640, height: 480 })
  })

  it('jPEG: keeps the rotation in a minimal EXIF block, with nothing else', () => {
    const out = stripImageMetadata(jpeg(6), 'image/jpeg')
    expect(has(out, 'GPS')).toBe(false)
    expect(has(out, 'Exif')).toBe(true)
    const at = [...out].findIndex(
      (value, index) => value === 0x01 && out[index + 1] === 0x12
    )
    expect(out[at + 9]).toBe(6)
  })

  it('jPEG: an upright photo gets no EXIF block at all', () => {
    expect(has(stripImageMetadata(jpeg(1), 'image/jpeg'), 'Exif')).toBe(false)
  })

  it('pNG: removes the text and EXIF chunks, and keeps the image chunks', () => {
    const out = stripImageMetadata(png(), 'image/png')
    expect(has(out, 'tEXt')).toBe(false)
    expect(has(out, 'eXIf')).toBe(false)
    expect(has(out, 'IDAT')).toBe(true)
    expect(has(out, 'IEND')).toBe(true)
    expect(readImageSize(out)).toEqual({ width: 256, height: 200 })
  })

  it('webP: removes EXIF and XMP, clears their flags and fixes the RIFF size', () => {
    const out = stripImageMetadata(webp(), 'image/webp')
    expect(has(out, 'GPS')).toBe(false)
    expect(has(out, 'xmpmeta')).toBe(false)
    expect(has(out, 'VP8 ')).toBe(true)
    expect((out[20] ?? 0) & 0x0c).toBe(0)
    const size = new DataView(out.buffer).getUint32(4, true)
    expect(size).toBe(out.length - 8)
    expect(readImageSize(out)).toEqual({ width: 800, height: 480 })
  })

  it('gives back a file it cannot parse, as it is', () => {
    const broken = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff, 1, 2])
    expect(stripImageMetadata(broken, 'image/jpeg')).toBe(broken)
    const model = bytes('glTF', [2, 0, 0, 0])
    expect(stripImageMetadata(model, 'model/gltf-binary')).toBe(model)
  })
})

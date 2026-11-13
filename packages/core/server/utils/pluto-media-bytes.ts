import { imageMeta } from 'image-meta'

function startsWith(bytes: Uint8Array, signature: number[], at = 0): boolean {
  return signature.every((value, index) => bytes[at + index] === value)
}

function ascii(bytes: Uint8Array, at: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(at, at + length))
}

export function sniffMediaType(bytes: Uint8Array): string | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return 'image/jpeg'
  }
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'image/png'
  }
  if (ascii(bytes, 0, 6) === 'GIF87a' || ascii(bytes, 0, 6) === 'GIF89a') {
    return 'image/gif'
  }
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') {
    return 'image/webp'
  }
  if (ascii(bytes, 4, 4) === 'ftyp') {
    const brands = ascii(bytes, 8, Math.min(32, bytes.length - 8))
    if (brands.includes('avif') || brands.includes('avis')) {
      return 'image/avif'
    }
  }
  if (ascii(bytes, 0, 4) === 'glTF') {
    return 'model/gltf-binary'
  }
  if (ascii(bytes, 0, 5) === '%PDF-') {
    return 'application/pdf'
  }
  return null
}

export function readImageSize(
  bytes: Uint8Array
): { width: number; height: number } | null {
  try {
    const meta = imageMeta(bytes)
    return meta.width && meta.height
      ? { width: meta.width, height: meta.height }
      : null
  } catch {
    return null
  }
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let at = 0
  for (const part of parts) {
    out.set(part, at)
    at += part.length
  }
  return out
}

function exifOrientation(segment: Uint8Array): number {
  if (ascii(segment, 4, 6) !== 'Exif\0\0') {
    return 1
  }
  const tiff = segment.subarray(10)
  const little = ascii(tiff, 0, 2) === 'II'
  const view = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength)
  try {
    const ifd = view.getUint32(4, little)
    const count = view.getUint16(ifd, little)
    for (let index = 0; index < count; index++) {
      const entry = ifd + 2 + index * 12
      if (view.getUint16(entry, little) === 0x0112) {
        const value = view.getUint16(entry + 8, little)
        return value >= 1 && value <= 8 ? value : 1
      }
    }
  } catch {}
  return 1
}

function orientationSegment(orientation: number): Uint8Array {
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
  const body = [...'Exif\0\0'].map((char) => char.charCodeAt(0)).concat(tiff)
  const length = body.length + 2
  return new Uint8Array([0xff, 0xe1, length >> 8, length & 0xff, ...body])
}

function stripJpeg(bytes: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [bytes.subarray(0, 2)]
  let orientation = 1
  let at = 2
  while (at < bytes.length) {
    if (bytes[at] !== 0xff) {
      return bytes
    }
    const marker = bytes[at + 1] as number
    if (marker === 0xff) {
      at++
      continue
    }
    if (marker === 0xda || marker === 0xd9) {
      parts.push(bytes.subarray(at))
      break
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      parts.push(bytes.subarray(at, at + 2))
      at += 2
      continue
    }
    const length = ((bytes[at + 2] ?? 0) << 8) | (bytes[at + 3] ?? 0)
    if (length < 2 || at + 2 + length > bytes.length) {
      return bytes
    }
    const segment = bytes.subarray(at, at + 2 + length)
    if (marker === 0xe1) {
      orientation = Math.max(orientation, exifOrientation(segment))
    } else if (marker !== 0xed && marker !== 0xfe) {
      parts.push(segment)
    }
    at += 2 + length
  }
  if (orientation !== 1) {
    parts.splice(1, 0, orientationSegment(orientation))
  }
  return concat(parts)
}

const PNG_DROP = new Set(['eXIf', 'tEXt', 'iTXt', 'zTXt', 'tIME'])

function stripPng(bytes: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [bytes.subarray(0, 8)]
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let at = 8
  while (at + 12 <= bytes.length) {
    const length = view.getUint32(at)
    const end = at + 12 + length
    if (end > bytes.length) {
      return bytes
    }
    if (!PNG_DROP.has(ascii(bytes, at + 4, 4))) {
      parts.push(bytes.subarray(at, end))
    }
    at = end
  }
  return concat(parts)
}

function stripWebp(bytes: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = []
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let at = 12
  while (at + 8 <= bytes.length) {
    const name = ascii(bytes, at, 4)
    const length = view.getUint32(at + 4, true)
    const end = at + 8 + length + (length % 2)
    if (at + 8 + length > bytes.length) {
      return bytes
    }
    if (name === 'VP8X') {
      const chunk = bytes.slice(at, Math.min(end, bytes.length))
      chunk[8] = (chunk[8] ?? 0) & ~0x0c
      parts.push(chunk)
    } else if (name !== 'EXIF' && name !== 'XMP ') {
      parts.push(bytes.subarray(at, Math.min(end, bytes.length)))
    }
    at = end
  }
  const body = concat(parts)
  const header = new Uint8Array(12)
  header.set(bytes.subarray(0, 4))
  new DataView(header.buffer).setUint32(4, body.length + 4, true)
  header.set(bytes.subarray(8, 12), 8)
  return concat([header, body])
}

export function stripImageMetadata(
  bytes: Uint8Array,
  mimeType: string
): Uint8Array {
  if (mimeType === 'image/jpeg') {
    return stripJpeg(bytes)
  }
  if (mimeType === 'image/png') {
    return stripPng(bytes)
  }
  if (mimeType === 'image/webp') {
    return stripWebp(bytes)
  }
  return bytes
}

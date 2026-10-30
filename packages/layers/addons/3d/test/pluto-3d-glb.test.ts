import { describe, expect, it } from 'vitest'
import { glbExternalFiles } from '../app/lib/pluto-3d-glb'

/** A GLB with this JSON chunk (padded to 4 bytes) and no binary chunk. */
function glb(json: unknown): ArrayBuffer {
  let text = JSON.stringify(json)
  while (text.length % 4) {
    text += ' '
  }
  const body = new TextEncoder().encode(text)
  const out = new DataView(new ArrayBuffer(20 + body.length))
  out.setUint32(0, 0x46546c67, true)
  out.setUint32(4, 2, true)
  out.setUint32(8, 20 + body.length, true)
  out.setUint32(12, body.length, true)
  out.setUint32(16, 0x4e4f534a, true)
  new Uint8Array(out.buffer).set(body, 20)
  return out.buffer
}

describe('glbExternalFiles', () => {
  it('lists the images and buffers that the model links by URI', () => {
    const file = glb({
      images: [
        { uri: 'tex_diffuse.jpg' },
        { bufferView: 1 },
        { uri: 'data:image/png;base64,AA==' },
      ],
      buffers: [{ byteLength: 10 }, { uri: 'extra.bin' }],
    })
    expect(glbExternalFiles(file)).toEqual(['tex_diffuse.jpg', 'extra.bin'])
  })

  it('gives nothing for a self-contained model, and for a file that is not a GLB', () => {
    expect(
      glbExternalFiles(
        glb({ images: [{ bufferView: 0 }], buffers: [{ byteLength: 4 }] })
      )
    ).toEqual([])
    expect(
      glbExternalFiles(new TextEncoder().encode('not a model at all').buffer)
    ).toEqual([])
  })
})

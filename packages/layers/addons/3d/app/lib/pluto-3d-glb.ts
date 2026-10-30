/**
 * The files that a `.glb` links but does not hold: images and buffers with a
 * `uri` that is not a `data:` URI. Such a model shows without them (a model with
 * no texture). Reads only the JSON chunk; no three.js. An empty list for a file
 * that is not a valid GLB.
 */
export function glbExternalFiles(bytes: ArrayBuffer): string[] {
  const view = new DataView(bytes)
  // The header: "glTF", the version, the length. Then the first chunk: its length and "JSON".
  if (bytes.byteLength < 20 || view.getUint32(0, true) !== 0x46546c67) {
    return []
  }
  const length = view.getUint32(12, true)
  if (
    view.getUint32(16, true) !== 0x4e4f534a ||
    20 + length > bytes.byteLength
  ) {
    return []
  }
  try {
    const json = JSON.parse(
      new TextDecoder().decode(new Uint8Array(bytes, 20, length))
    ) as {
      images?: { uri?: string }[]
      buffers?: { uri?: string }[]
    }
    return [...(json.images ?? []), ...(json.buffers ?? [])]
      .map((entry) => entry.uri)
      .filter((uri): uri is string => Boolean(uri) && !uri!.startsWith('data:'))
  } catch {
    return []
  }
}

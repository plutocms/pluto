export function glbExternalFiles(bytes: ArrayBuffer): string[] {
  const view = new DataView(bytes)
  // Header: "glTF", version, length. First chunk: length, then "JSON".
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

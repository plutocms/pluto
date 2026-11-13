/** Encodes a content id for a URL path. It keeps the `/` between segments, so `guide/intro` does not become `guide%2Fintro`. */
export function contentIdPath(id: string | number): string {
  return String(id)
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

const NUMERIC_PREFIX = /^(\d+)\./

function splitSegment(segment: string): {
  order: number | null
  name: string
} {
  const match = NUMERIC_PREFIX.exec(segment)
  return match
    ? {
        order: Number.parseInt(match[1]!, 10),
        name: segment.slice(match[0].length),
      }
    : { order: null, name: segment }
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function compareSegments(a: string, b: string): number {
  if (a === b) {
    return 0
  }
  if (a === 'index' || b === 'index') {
    return a === 'index' ? -1 : 1
  }
  const left = splitSegment(a)
  const right = splitSegment(b)
  if (left.order !== right.order) {
    if (left.order === null || right.order === null) {
      return left.order === null ? 1 : -1
    }
    return left.order - right.order
  }
  return compareText(left.name, right.name) || compareText(a, b)
}

/**
 * Compares two nested content ids, segment by segment, for `Array.sort`. In each segment, `index`
 * comes first, then a numeric prefix (`2.name`) sorts as a number and before a plain name, then
 * the name decides. A folder comes before the items inside it.
 */
export function compareContentIds(a: string, b: string): number {
  const left = a.split('/')
  const right = b.split('/')
  const length = Math.min(left.length, right.length)
  for (let index = 0; index < length; index++) {
    const result = compareSegments(left[index]!, right[index]!)
    if (result !== 0) {
      return result
    }
  }
  return left.length - right.length
}

/**
 * Encodes a content id for a URL path. It encodes each segment and keeps the
 * `/` between segments, so a nested id (`guide/intro`) stays readable and
 * does not become `guide%2Fintro`. A flat id gives the same text as
 * `encodeURIComponent`.
 */
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
  // `index` comes first in its folder.
  if (a === 'index' || b === 'index') {
    return a === 'index' ? -1 : 1
  }
  const left = splitSegment(a)
  const right = splitSegment(b)
  if (left.order !== right.order) {
    // A numbered segment comes before a plain one.
    if (left.order === null || right.order === null) {
      return left.order === null ? 1 : -1
    }
    return left.order - right.order
  }
  return compareText(left.name, right.name) || compareText(a, b)
}

/**
 * Compares two nested content ids, segment by segment. In each segment,
 * `index` comes first. Then a numeric prefix (`2.name`) sorts as a number,
 * and a numbered segment comes before a plain one. Then the name decides. A
 * folder comes before the items inside it. Use it as an `Array.sort`
 * comparator.
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

import type {
  PlutoContentItem,
  PlutoContentType,
  PlutoField,
} from '../types/content'

/** One line of a line diff. */
export interface PlutoDiffLine {
  kind: 'same' | 'add' | 'remove'
  text: string
}

/** Above this many cells (lines × lines), `diffLines` gives a plain replace. */
const MAX_DIFF_CELLS = 4_000_000

/**
 * A line diff from `before` to `after` (the longest common subsequence of the lines). The common
 * start and end are kept as `same` lines. A very large change is one remove block and one add
 * block, so the browser never hangs. Pure.
 */
export function diffLines(before: string, after: string): PlutoDiffLine[] {
  const a = before.split('\n')
  const b = after.split('\n')
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) {
    start++
  }
  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--
    endB--
  }
  const head = a.slice(0, start).map((text) => ({ kind: 'same' as const, text }))
  const tail = a.slice(endA).map((text) => ({ kind: 'same' as const, text }))
  const midA = a.slice(start, endA)
  const midB = b.slice(start, endB)

  if (midA.length * midB.length > MAX_DIFF_CELLS) {
    return [
      ...head,
      ...midA.map((text) => ({ kind: 'remove' as const, text })),
      ...midB.map((text) => ({ kind: 'add' as const, text })),
      ...tail,
    ]
  }

  // lengths[i][j]: the LCS length of midA[i..] and midB[j..].
  const rows = midA.length + 1
  const cols = midB.length + 1
  const lengths = new Uint32Array(rows * cols)
  for (let i = midA.length - 1; i >= 0; i--) {
    for (let j = midB.length - 1; j >= 0; j--) {
      lengths[i * cols + j] =
        midA[i] === midB[j]
          ? lengths[(i + 1) * cols + j + 1]! + 1
          : Math.max(lengths[(i + 1) * cols + j]!, lengths[i * cols + j + 1]!)
    }
  }
  const middle: PlutoDiffLine[] = []
  let i = 0
  let j = 0
  while (i < midA.length && j < midB.length) {
    if (midA[i] === midB[j]) {
      middle.push({ kind: 'same', text: midA[i]! })
      i++
      j++
    } else if (lengths[(i + 1) * cols + j]! >= lengths[i * cols + j + 1]!) {
      middle.push({ kind: 'remove', text: midA[i]! })
      i++
    } else {
      middle.push({ kind: 'add', text: midB[j]! })
      j++
    }
  }
  for (; i < midA.length; i++) {
    middle.push({ kind: 'remove', text: midA[i]! })
  }
  for (; j < midB.length; j++) {
    middle.push({ kind: 'add', text: midB[j]! })
  }
  return [...head, ...middle, ...tail]
}

/**
 * The fields that a restore copies from a revision: the stored form fields, except the slug field
 * (the id stays) and the status field (a restore does not publish or unpublish). Timestamps and
 * `_version` are not fields, so they stay too.
 */
export function restorableFields(type: PlutoContentType): PlutoField[] {
  const slugField = type.slug ? type.slug.field : undefined
  const statusColumn = type.status ? (type.status.column ?? 'status') : undefined
  return type.fields.filter(
    (field) =>
      !field.virtual &&
      field.inForm !== false &&
      field.name !== slugField &&
      field.name !== statusColumn
  )
}

/** The values that a restore puts in the form: the restorable fields of the revision. */
export function revisionRestoreValues(
  type: PlutoContentType,
  revision: PlutoContentItem
): Record<string, unknown> {
  return Object.fromEntries(
    restorableFields(type).map((field) => [field.name, revision[field.name] ?? null])
  )
}

/** One changed field between the form and a revision. */
export type PlutoFieldChange =
  | {
      field: PlutoField
      /** A long or multi-line text: a line diff. */
      kind: 'text'
      lines: PlutoDiffLine[]
    }
  | {
      field: PlutoField
      /** Any other value: the value now and the value of the revision, as text. */
      kind: 'value'
      before: string
      after: string
    }

function asText(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2)
}

/**
 * What a change from `current` to `next` does in each of `fields`: one entry for each field
 * whose value differs, in field order. A key that `next` does not have counts as empty. Pure.
 */
export function diffFields(
  fields: PlutoField[],
  current: Record<string, unknown>,
  next: Record<string, unknown>
): PlutoFieldChange[] {
  const changes: PlutoFieldChange[] = []
  for (const field of fields) {
    const before = asText(current[field.name])
    const after = asText(next[field.name])
    if (before === after) {
      continue
    }
    if (
      field.type === 'richtext' ||
      field.type === 'textarea' ||
      before.includes('\n') ||
      after.includes('\n')
    ) {
      changes.push({ field, kind: 'text', lines: diffLines(before, after) })
    } else {
      changes.push({ field, kind: 'value', before, after })
    }
  }
  return changes
}

/**
 * What a restore of `revision` would change in `current` (the form): one entry for each
 * restorable field whose value differs, in field order. Pure.
 */
export function diffRevision(
  type: PlutoContentType,
  current: Record<string, unknown>,
  revision: PlutoContentItem
): PlutoFieldChange[] {
  return diffFields(restorableFields(type), current, revision)
}

/** A row of a folded diff: a line, or a run of unchanged lines that the view hides. */
export type PlutoDiffRow =
  | PlutoDiffLine
  | {
      kind: 'skip'
      count: number
    }

/**
 * Folds the unchanged lines of a diff that are more than `context` lines from a change into one
 * `skip` row, so a long body shows only its changes. A run of one line stays a line. Pure.
 */
export function foldDiff(lines: PlutoDiffLine[], context = 2): PlutoDiffRow[] {
  const near = Array.from({length: lines.length}).fill(false)
  lines.forEach((line, index) => {
    if (line.kind === 'same') {
      return
    }
    const from = Math.max(0, index - context)
    const to = Math.min(lines.length - 1, index + context)
    for (let i = from; i <= to; i++) {
      near[i] = true
    }
  })
  const rows: PlutoDiffRow[] = []
  let hidden: PlutoDiffLine[] = []
  const flush = () => {
    if (hidden.length === 1) {
      rows.push(hidden[0]!)
    } else if (hidden.length > 1) {
      rows.push({ kind: 'skip', count: hidden.length })
    }
    hidden = []
  }
  lines.forEach((line, index) => {
    if (line.kind === 'same' && !near[index]) {
      hidden.push(line)
      return
    }
    flush()
    rows.push(line)
  })
  flush()
  return rows
}

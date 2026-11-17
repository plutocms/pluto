import type { PlutoFormField, PlutoFormSubmission } from '../types/forms'

const CSV_BOM = String.fromCharCode(0xFEFF)

const FORMULA_START = /^[=+\-@\t\r]/

/**
 * One cell of a CSV file. A text that starts with `=`, `+`, `-`, `@`, a tab or a carriage return
 * gets a `'` before it, so a spreadsheet does not run it as a formula. A cell with a comma, a
 * quote or a line break is quoted.
 */
export function plutoCsvCell(value: unknown): string {
  let text = ''
  if (typeof value === 'string') {
    text = FORMULA_START.test(value) ? `'${value}` : value
  } else if (typeof value === 'number' || typeof value === 'boolean') {
    text = String(value)
  }
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

/**
 * The submissions of a form as a CSV text: the id, the date, then one column for each field
 * (and for each other key that an older submission holds). A checkbox is `yes` or `no`.
 * @see https://pluto.vulmix.dev/docs/build/forms
 */
export function plutoFormsCsv(
  fields: PlutoFormField[],
  submissions: PlutoFormSubmission[]
): string {
  const names = fields.map((field) => field.name)
  const known = new Set(names)
  for (const submission of submissions) {
    for (const key of Object.keys(submission.values)) {
      if (!known.has(key)) {
        known.add(key)
        names.push(key)
      }
    }
  }
  const labels = new Map(fields.map((field) => [field.name, field.label]))
  const rows = [
    ['id', 'date', ...names.map((name) => labels.get(name) || name)],
    ...submissions.map((submission) => [
      submission.id,
      submission.createdAt,
      ...names.map((name) => {
        const value = submission.values[name]
        return typeof value === 'boolean' ? (value ? 'yes' : 'no') : value
      }),
    ]),
  ]
  return `${CSV_BOM}${rows.map((row) => row.map((cell) => plutoCsvCell(cell)).join(',')).join('\r\n')}\r\n`
}

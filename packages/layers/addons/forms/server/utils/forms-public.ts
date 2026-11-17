import type { PlutoContentToPublic } from '#layers/pluto/shared/types/content'
import type { PlutoFormBlocks } from '../../shared/utils/forms-fields'

const PRIVATE_KEYS = ['recipients', 'subject', 'redirect', 'retentionDays']

/**
 * The public answer of one `form` item: the title, the handle, the success message and the
 * fields. The settings never go out, also when the allow-list of the type is wrong or a layer
 * changes it. `data` is the answer after the allow-list.
 */
export function buildPublicFormData(
  data: Record<string, unknown>,
  blocks: PlutoFormBlocks | null,
  custom: Record<string, string> = {}
): Record<string, unknown> {
  const out = { ...data }
  for (const key of PRIVATE_KEYS) {
    delete out[key]
  }
  const { fields, submitLabel } = plutoFormFields(blocks, { custom })
  return { ...out, fields, submitLabel }
}

/**
 * The `toPublic` hook of the form type: it parses the body of the item and adds the fields. The
 * server plugin of the layer gives it the real parser.
 */
export function createFormsToPublic(deps: {
  parse: (text: string) => Promise<PlutoFormBlocks>
  custom: () => Record<string, string>
}): PlutoContentToPublic {
  return async (_context, data, { item }) =>
    buildPublicFormData(
      data,
      await deps.parse(typeof item.body === 'string' ? item.body : ''),
      deps.custom()
    )
}

import type { PlutoFormField } from '../../shared/types/forms'
import { computed } from 'vue'

/**
 * The field that a field block stands for, with the same rules as a form (`plutoFormFields`). A
 * field block uses it to draw the default markup in the block editor, and a custom field block
 * can use it too. `block` is the name of the block, for example `form-input`.
 *
 * @see https://pluto.vulmix.dev/docs/build/forms
 */
export function usePlutoFormBlockField(block: string, props: object) {
  const custom = (
    useAppConfig().plutoForms as
      | { fieldTypes?: Array<{ name: string; block: string }> }
      | undefined
  )?.fieldTypes

  return computed<PlutoFormField>(() => {
    const { fields } = plutoFormFields(
      { nodes: [[block, { ...props }]] },
      { custom: plutoFormCustomTypes(custom as never).blocks }
    )
    return fields[0] ?? { name: 'field', type: 'text', label: '' }
  })
}

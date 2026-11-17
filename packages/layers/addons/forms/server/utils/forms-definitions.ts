import type {
  PlutoFormDefinition,
  PlutoFormFieldTypeInput,
  PlutoFormSettings,
} from '../../shared/types/forms'
import type { PlutoFormBlocks } from '../../shared/utils/forms-fields'

export interface PlutoFormsAppConfig {
  forms?: PlutoFormDefinition[]
  fieldTypes?: PlutoFormFieldTypeInput[]
}

export interface PlutoFormSummary {
  handle: string
  title: string
  source: 'content' | 'code'
  settings: PlutoFormSettings
}

/**
 * Builds a form from its sources, with no I/O. A code form gives the structure. A `form` item of
 * the admin gives the structure of a form with no code, and the texts and the settings of both.
 */
export function buildFormDefinition(input: {
  handle: string
  code?: PlutoFormDefinition
  item?: Record<string, unknown> | null
  blocks?: PlutoFormBlocks | null
  custom?: Record<string, string>
}): PlutoFormDefinition | null {
  if (input.code) {
    return plutoMergeForm(input.code, input.item)
  }
  if (!input.item) {
    return null
  }
  const { fields, submitLabel } = plutoFormFields(input.blocks, {
    custom: input.custom,
  })
  const title =
    typeof input.item.title === 'string' && input.item.title.trim()
      ? input.item.title.trim()
      : input.handle
  return {
    handle: input.handle,
    title,
    fields,
    submitLabel,
    settings: plutoFormSettings(input.item),
    source: 'content',
  }
}

export function getFormsAppConfig(): PlutoFormsAppConfig {
  return (useAppConfig().plutoForms ?? {}) as PlutoFormsAppConfig
}

async function readContentItem(
  handle: string
): Promise<Record<string, unknown> | null> {
  const type = getContentType('form')
  const adapter = getContentAdapter()
  if (!type || !adapter) {
    return null
  }
  try {
    return await adapter.get(
      { event: createPlutoSystemEvent(), type },
      handle
    )
  } catch (error) {
    console.warn(
      `[pluto-forms] Could not read the form "${handle}": ${(error as Error).message}`
    )
    return null
  }
}

/**
 * Loads a form by its handle: the code form, the `form` item of the admin, or both. It reads the
 * content with a system request, so the settings are there. Never send the result to a browser:
 * use `plutoPublicForm`.
 */
export async function loadFormDefinition(
  handle: string
): Promise<PlutoFormDefinition | null> {
  if (!PLUTO_FORM_HANDLE.test(handle)) {
    return null
  }
  const config = getFormsAppConfig()
  const code = (config.forms ?? []).find((form) => form.handle === handle)
  const item = await readContentItem(handle)
  const body =
    item && typeof item.body === 'string' && !code
      ? await parsePlutoBlocks(item.body)
      : null
  return buildFormDefinition({
    handle,
    code,
    item,
    blocks: body,
    custom: plutoFormCustomTypes(config.fieldTypes).blocks,
  })
}

/**
 * Every form with its settings, no fields: the code forms (with the texts of an item of the same
 * handle) and the items of the admin. The admin pages and the purge use it.
 */
export async function listFormSummaries(): Promise<PlutoFormSummary[]> {
  const summaries = new Map<string, PlutoFormSummary>()
  for (const form of getFormsAppConfig().forms ?? []) {
    summaries.set(form.handle, {
      handle: form.handle,
      title: form.title,
      source: 'code',
      settings: form.settings,
    })
  }

  const type = getContentType('form')
  const adapter = getContentAdapter()
  if (type && adapter) {
    try {
      const { data } = await adapter.list(
        { event: createPlutoSystemEvent(), type },
        { limit: 500, offset: 0, includeUnpublished: true }
      )
      for (const item of data) {
        const handle = String(item.slug ?? item.id)
        const code = summaries.get(handle)
        const settings = plutoFormSettings(item, code?.settings)
        summaries.set(handle, {
          handle,
          title:
            typeof item.title === 'string' && item.title
              ? item.title
              : (code?.title ?? handle),
          source: code ? 'code' : 'content',
          settings,
        })
      }
    } catch (error) {
      console.warn(
        `[pluto-forms] Could not list the forms: ${(error as Error).message}`
      )
    }
  }
  return [...summaries.values()]
}

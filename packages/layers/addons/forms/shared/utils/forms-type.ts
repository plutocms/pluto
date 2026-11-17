import type { PlutoContentType } from '#layers/pluto/shared/types/content'
import { PLUTO_FORM_BLOCKS } from './forms-fields'

/** The parts of the form type that a backend sets: where the forms live, and its columns. */
export type PlutoFormTypeStorage = Pick<
  PlutoContentType,
  'source' | 'files' | 'timestamps' | 'capabilities' | 'defaultSort'
>

export const PLUTO_FORMS_WRITE = 'forms:write'

export const PLUTO_FORMS_READ_SUBMISSIONS = 'forms:read_submissions'

/**
 * The `form` content type, the same for every backend: a title, a handle (`contact`), a body of
 * field blocks, and the settings. A form has no status: it is always live. The public API
 * gives the title, the handle and the success message only (the server adds the fields). A
 * backend layer calls this with its storage parts.
 * @example
 * export const formType = definePlutoFormType({
 *   source: 'forms',
 *   timestamps: { created: 'created_at', updated: 'updated_at' },
 *   capabilities: { write: 'forms:write', delete: 'forms:write' },
 * })
 * @see https://pluto.vulmix.dev/docs/build/forms
 */
export function definePlutoFormType(
  storage: PlutoFormTypeStorage
): PlutoContentType {
  return {
    name: 'form',
    label: 'Form',
    labelPlural: 'Forms',
    description:
      'A form for the site: fields, who gets the email, and what the visitor sees after sending. A page shows it with the form block.',
    icon: 'i-lucide-text-cursor-input',
    titleField: 'title',
    fields: [
      {
        name: 'title',
        type: 'text',
        label: 'Title',
        required: true,
        inList: true,
        order: 10,
        region: 'side',
      },
      {
        name: 'slug',
        type: 'slug',
        label: 'Handle',
        description:
          'The name that a page uses to find the form, for example contact.',
        from: 'title',
        required: true,
        inList: true,
        order: 20,
        region: 'side',
      },
      {
        name: 'recipients',
        type: 'textarea',
        label: 'Send the email to',
        description:
          'One address, or more separated by commas. Empty: no email, the submissions stay in the store.',
        rows: 2,
        order: 30,
        region: 'side',
      },
      {
        name: 'subject',
        type: 'text',
        label: 'Email subject',
        maxLength: 150,
        order: 31,
        region: 'side',
      },
      {
        name: 'successMessage',
        type: 'textarea',
        label: 'Message after sending',
        maxLength: 500,
        rows: 2,
        order: 32,
        region: 'side',
      },
      {
        name: 'redirect',
        type: 'text',
        label: 'Open this page after sending',
        description: 'A path (/thanks) or a URL. Empty: show the message.',
        order: 33,
        region: 'side',
      },
      {
        name: 'retentionDays',
        type: 'number',
        label: 'Keep submissions (days)',
        description: 'The store deletes older submissions. 0 keeps them for ever.',
        integer: true,
        min: 0,
        max: 3650,
        default: 180,
        order: 34,
        region: 'side',
      },
      {
        name: 'body',
        type: 'richtext',
        label: 'Fields',
        widget: 'blocks',
        editor: 'visual',
        blocks: [...PLUTO_FORM_BLOCKS],
        order: 40,
        region: 'main',
      },
    ],
    slug: { field: 'slug' },
    status: false,
    liveOnSave: true,
    api: { public: true, fields: ['title', 'slug', 'successMessage'] },
    trash: true,
    form: {
      layout: 'canvas',
      canvasField: 'body',
      leftPanel: {
        label: 'pluto.blocks.editor.blocks',
        class: 'bg-pluto-panel',
      },
    },
    ...storage,
  }
}

/** The form type of the Git CMS: `content/forms/<handle>.md`. */
export const plutoFormsGitType = definePlutoFormType({
  source: 'forms',
  timestamps: { created: 'createdAt', updated: 'updatedAt' },
  capabilities: {
    write: PLUTO_FORMS_WRITE,
    delete: PLUTO_FORMS_WRITE,
  },
  defaultSort: { field: 'id', direction: 'asc' },
})

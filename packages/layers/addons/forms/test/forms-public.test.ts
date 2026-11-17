import type { H3Event } from 'h3'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { parsePlutoBlocks } from '../../../../core/server/utils/pluto-blocks'
import {
  registerContentAdapter,
  registerContentType,
} from '../../../../core/server/utils/pluto-content'
import {
  getPublicContent,
  listPublicContent,
  publicFieldNames,
} from '../../../../core/server/utils/pluto-public-api'
import {
  buildPublicFormData,
  createFormsToPublic,
} from '../server/utils/forms-public'
import { definePlutoFormType, plutoFormsGitType } from '../shared/utils/forms-type'

vi.mock('../../../../core/server/utils/pluto-api-config', () => ({
  getPlutoApiConfig: () => ({ cors: true, maxAge: 60 }),
}))

const ITEM = {
  id: 'contact',
  slug: 'contact',
  title: 'Contact',
  recipients: 'boss@example.com',
  subject: 'Secret subject',
  successMessage: 'Thanks!',
  redirect: '/thanks',
  retentionDays: 30,
  body: [
    '::form-input{label="Name" required}',
    '::',
    '',
    '::form-submit{label="Go"}',
    '::',
  ].join('\n'),
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
}

function fakeEvent(): H3Event {
  return {
    node: {
      req: { headers: {} },
      res: { setHeader: () => {}, getHeader: () => undefined },
    },
    context: {},
  } as unknown as H3Event
}

describe('the form type', () => {
  it('is public, with no status, and its body takes only the field blocks', () => {
    const body = plutoFormsGitType.fields.find((field) => field.name === 'body')

    expect(plutoFormsGitType.api?.public).toBe(true)
    expect(plutoFormsGitType.status).toBe(false)
    expect(body).toMatchObject({
      widget: 'blocks',
      blocks: [
        'form-input',
        'form-textarea',
        'form-select',
        'form-radio',
        'form-checkbox',
        'form-consent',
        'form-hidden',
        'form-submit',
      ],
    })
    expect(plutoFormsGitType.capabilities).toEqual({
      write: 'forms:write',
      delete: 'forms:write',
    })
    expect(plutoFormsGitType.source).toBe('forms')
  })

  it('takes the storage parts of a backend', () => {
    const type = definePlutoFormType({
      source: 'forms',
      capabilities: { write: 'forms:write' },
    })

    expect(type.source).toBe('forms')
    expect(type.name).toBe('form')
  })
})

describe('the public API of the form type', () => {
  it('lists only the title, the handle and the success message', () => {
    const names = publicFieldNames(plutoFormsGitType)

    expect(names.sort()).toEqual(['slug', 'successMessage', 'title'])
    for (const secret of ['recipients', 'subject', 'redirect', 'retentionDays']) {
      expect(names).not.toContain(secret)
    }
  })

  it('adds the fields and drops the settings, also if the allow-list were wrong', () => {
    const data = buildPublicFormData(
      {
        id: 'contact',
        title: 'Contact',
        slug: 'contact',
        recipients: 'boss@example.com',
        subject: 'Secret subject',
        redirect: '/x',
        retentionDays: 30,
      },
      { nodes: [['form-input', { label: 'Name' }], ['form-submit', { label: 'Go' }]] }
    )

    expect(data).toEqual({
      id: 'contact',
      title: 'Contact',
      slug: 'contact',
      fields: [{ name: 'name', type: 'text', label: 'Name' }],
      submitLabel: 'Go',
    })
    expect(JSON.stringify(data)).not.toContain('boss@example.com')
  })
})

describe('the real public API', () => {
  beforeAll(() => {
    registerContentType({
      ...plutoFormsGitType,
      hooks: {
        toPublic: createFormsToPublic({
          parse: parsePlutoBlocks,
          custom: () => ({}),
        }),
      },
    })
    registerContentAdapter({
      id: 'fake',
      list: async () => ({ data: [ITEM], total: 1 }),
      get: async (_context, id) => (id === 'contact' ? ITEM : null),
      create: async () => ITEM,
      update: async () => ITEM,
      remove: async () => {},
      timestampKeys: () => ({ created: 'createdAt', updated: 'updatedAt' }),
    })
  })

  it('answers one form with the fields and none of the settings', async () => {
    const answer = await getPublicContent(fakeEvent(), 'form', 'contact')
    const json = JSON.stringify(answer)

    expect(answer.data).toMatchObject({
      id: 'contact',
      title: 'Contact',
      slug: 'contact',
      successMessage: 'Thanks!',
      submitLabel: 'Go',
      fields: [{ name: 'name', type: 'text', label: 'Name', required: true }],
    })
    for (const secret of ['boss@example.com', 'Secret subject', '/thanks', 'retentionDays', 'recipients']) {
      expect(json).not.toContain(secret)
    }
  })

  it('answers the list with the fields and none of the settings', async () => {
    const answer = await listPublicContent(fakeEvent(), 'form', {})
    const json = JSON.stringify(answer)

    expect(answer.data[0]).toMatchObject({ title: 'Contact', fields: expect.any(Array) })
    expect(json).not.toContain('boss@example.com')
    expect(json).not.toContain('Secret subject')
  })

  it('refuses to sort or filter by a setting', async () => {
    await expect(
      listPublicContent(fakeEvent(), 'form', { sort: 'recipients' })
    ).rejects.toMatchObject({ statusCode: 400 })
    await expect(
      listPublicContent(fakeEvent(), 'form', { 'filter[recipients]': 'boss@example.com' })
    ).rejects.toMatchObject({ statusCode: 400 })
  })
})

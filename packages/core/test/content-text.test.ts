import type { PlutoContentType } from '../shared/types/content'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, ref, toValue } from 'vue'
import { createContentText } from '../app/composables/internal/content-text'
import { createI18nStub } from './fixtures/i18n-stub'

const type: PlutoContentType = {
  name: 'post',
  label: 'Post',
  labelPlural: 'Posts',
  source: 'posts',
  titleField: 'title',
  fields: [
    {
      name: 'title',
      type: 'text',
      label: 'Title',
      description: 'The headline.',
      placeholder: 'Type a title',
    },
    {
      name: 'kind',
      type: 'select',
      label: 'Kind',
      options: [
        { label: 'News', value: 'news' },
        { label: 'Tip', value: 'tip' },
      ],
    },
  ],
}

/** An i18n object with extra messages, as a layer's locale file would add. */
function withMessages(
  messages: Record<string, string>,
  locale:
    | string
    | {
        value: string
      } = 'en'
) {
  const stub = createI18nStub(locale)
  return {
    ...stub,
    te: (key: string) => key in messages || stub.te(key),
    t: (key: string, params?: Record<string, unknown> | number) =>
      messages[key] ?? stub.t(key, params),
  }
}

describe('createContentText', () => {
  it('returns the English literals when no key exists', () => {
    const text = createContentText(() => type, createI18nStub())

    expect(text.label).toBe('Post')
    expect(text.labelPlural).toBe('Posts')
    expect(text.labelLower).toBe('post')
    expect(text.labelPluralLower).toBe('posts')
    expect(text.newLabel).toBe('New Post')
    expect(text.fieldLabel(type.fields[0]!)).toBe('Title')
    expect(text.statusLabel('draft', 'Draft')).toBe('Draft')
    expect(text.statusLabel('draft')).toBe('draft')
    expect(text.field(type.fields[1]!)).toEqual(type.fields[1])
  })

  it('prefers a convention key over the literal', () => {
    const text = createContentText(
      () => type,
      withMessages({
        'content.post.label': 'Artigo',
        'content.post.labelPlural': 'Artigos',
        'content.post.new': 'Novo artigo',
        'content.post.status.draft': 'Rascunho',
        'content.post.fields.title.label': 'Título',
      })
    )

    expect(text.label).toBe('Artigo')
    expect(text.labelPlural).toBe('Artigos')
    expect(text.labelPluralLower).toBe('artigos')
    expect(text.newLabel).toBe('Novo artigo')
    expect(text.statusLabel('draft', 'Draft')).toBe('Rascunho')
    expect(text.statusLabel('published', 'Published')).toBe('Published')
    expect(text.fieldLabel(type.fields[0]!)).toBe('Título')
  })

  it('builds the new label from the core phrase and the translated label when there is no .new key', () => {
    expect(
      createContentText(
        () => type,
        withMessages({ 'content.post.label': 'Artigo' })
      ).newLabel
    ).toBe('New Artigo')
    expect(
      createContentText(
        () => type,
        withMessages({ 'content.post.label': 'Artigo' }, 'pt-BR')
      ).newLabel
    ).toBe('Criar Artigo')
  })

  it('returns a translated copy of a field and never changes the original', () => {
    const text = createContentText(
      () => type,
      withMessages({
        'content.post.fields.title.label': 'Título',
        'content.post.fields.title.description': 'O título.',
        'content.post.fields.title.placeholder': 'Digite um título',
        'content.post.fields.kind.options.news': 'Notícia',
      })
    )

    const title = text.field(type.fields[0]!)
    const kind = text.field(type.fields[1]!)

    expect(title).toMatchObject({
      name: 'title',
      type: 'text',
      label: 'Título',
      description: 'O título.',
      placeholder: 'Digite um título',
    })
    expect(kind).toMatchObject({
      options: [
        { label: 'Notícia', value: 'news' },
        { label: 'Tip', value: 'tip' },
      ],
    })
    expect(type.fields[0]).toMatchObject({
      label: 'Title',
      description: 'The headline.',
      placeholder: 'Type a title',
    })
  })

  it('does not add a description or a placeholder that nobody set', () => {
    const copy = createContentText(() => type, createI18nStub()).field({
      name: 'n',
      type: 'number',
      label: 'N',
    })

    expect(copy).toEqual({ name: 'n', type: 'number', label: 'N' })
  })

  it('reads the type again on each call, so a changed type shows at once', () => {
    const current = ref<PlutoContentType | undefined>(type)
    const text = createContentText(() => current.value, createI18nStub())

    expect(text.label).toBe('Post')

    current.value = { ...type, label: 'Page' }

    expect(text.label).toBe('Page')
  })

  it('follows the locale', () => {
    const locale = ref('en')
    const text = createContentText(() => type, createI18nStub(locale))

    expect(text.newLabel).toBe('New Post')

    locale.value = 'pt-BR'

    expect(text.newLabel).toBe('Criar Post')
  })
})

describe('usePlutoContentText', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('wraps createContentText with the admin i18n and accepts a ref', async () => {
    vi.stubGlobal('computed', computed)
    vi.stubGlobal('toValue', toValue)
    vi.stubGlobal('usePlutoI18n', () =>
      withMessages({ 'content.post.labelPlural': 'Artigos' })
    )
    const { usePlutoContentText } =
      await import('../app/composables/pluto-content-text')

    const text = usePlutoContentText(ref(type))

    expect(text.labelPlural).toBe('Artigos')
    expect(text.label).toBe('Post')
  })
})

import { describe, expect, it } from 'vitest'
import { resolveErrorText } from '../app/composables/internal/error-text'
import { createPlutoError } from '../server/utils/pluto-error'
import { createI18nStub } from './fixtures/i18n-stub'

describe('createPlutoError', () => {
  it('keeps the message in English as the statusMessage and adds the i18n key', () => {
    const error = createPlutoError({
      statusCode: 404,
      message: 'Content type "post" not found.',
      key: 'pluto.errors.contentTypeNotFound',
      params: { name: 'post' },
    })

    expect(error.statusCode).toBe(404)
    expect(error.statusMessage).toBe('Content type "post" not found.')
    expect(error.data).toEqual({ i18n: { key: 'pluto.errors.contentTypeNotFound', params: { name: 'post' } } })
  })

  it('keeps extra data next to the i18n pair', () => {
    const error = createPlutoError({
      statusCode: 400,
      message: 'Validation failed.',
      key: 'pluto.errors.validationFailed',
      data: { errors: [{ field: 'title' }] },
    })

    expect(error.data).toMatchObject({ errors: [{ field: 'title' }], i18n: { key: 'pluto.errors.validationFailed' } })
  })
})

describe('resolveErrorText', () => {
  const en = createI18nStub('en')
  const pt = createI18nStub('pt-BR')
  // What a $fetch error holds: the whole response body is in `data`.
  const fetchError = {
    statusMessage: 'Content type "post" not found.',
    data: {
      statusMessage: 'Content type "post" not found.',
      message: 'Content type "post" not found.',
      data: { i18n: { key: 'pluto.errors.contentTypeNotFound', params: { name: 'post' } } },
    },
  }

  it('prefers the translated data.i18n of a server error', () => {
    expect(resolveErrorText(fetchError, 'pluto.form.saveError', pt)).toBe('Tipo de conteúdo "post" não encontrado.')
    expect(resolveErrorText(fetchError, 'pluto.form.saveError', en)).toBe('Content type "post" not found.')
  })

  it('reads data.i18n of an error that Nuxt created on the client', () => {
    const error = { data: { i18n: { key: 'pluto.errors.notFound' } } }

    expect(resolveErrorText(error, 'pluto.form.saveError', pt)).toBe('Não encontrado.')
  })

  it('uses the server statusMessage when the key is unknown or missing', () => {
    const unknownKey = { statusMessage: 'Forbidden', data: { data: { i18n: { key: 'nope.missing' } } } }
    const noKey = { statusMessage: 'Forbidden' }

    expect(resolveErrorText(unknownKey, 'pluto.form.saveError', pt)).toBe('Forbidden')
    expect(resolveErrorText(noKey, 'pluto.form.saveError', pt)).toBe('Forbidden')
  })

  it('uses the server message when there is no statusMessage', () => {
    expect(resolveErrorText({ data: { message: 'Boom' } }, 'pluto.form.saveError', en)).toBe('Boom')
  })

  it('falls back to the translated fallback key', () => {
    expect(resolveErrorText(new Error('network'), 'pluto.form.saveError', pt)).toBe('Ocorreu um erro ao salvar.')
    expect(resolveErrorText(undefined, 'pluto.errors.unknown', en)).toBe('Something went wrong.')
    expect(resolveErrorText({ statusMessage: '  ' }, 'pluto.form.saveError', en)).toBe('An error occurred while saving.')
  })
})

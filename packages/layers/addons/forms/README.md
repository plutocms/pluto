# @plutocms/forms

**Docs:** [Forms](https://pluto.vulmix.dev/docs/layers/forms)

An add-on layer for [Pluto](https://pluto.vulmix.dev) sites: forms for any site. An editor builds a
form from blocks in the admin. A developer can define a form in code, draw it with their own markup,
add field types and hook the server. Each submission goes to a store, and to an email.

- **Built from blocks.** The editor of the `form` type has a block for each field: input, text area,
  select, radio buttons, checkbox, consent, hidden value and the submit button.
- **Fully customizable.** `definePlutoForm`, `usePlutoForm` (headless), field components that the
  site overrides by name, custom field types, and server hooks.
- **Spam protection built in.** A hidden field, a minimum fill time (a signed token), a rate limit
  for each IP, and Cloudflare Turnstile when the site sets its keys.
- **A store you choose.** Submissions have personal data, so they never go in the Git repository.
  The default store is a Nitro storage mount. In development it is a folder, with no setup.
- **Submissions in the admin.** A table, a detail view, delete and a CSV export that guards against
  spreadsheet formulas.
- **Accessible by default.** Real labels, `aria-describedby` for the help and error texts,
  `aria-invalid`, an error summary that takes focus, and a polite live region for the result.
- **Plain CSS.** It works with or without Tailwind and Nuxt UI.

## Install

```bash
npm install @plutocms/forms
```

Add it next to the backend layer of your app. It does not bring Pluto: the app or the backend layer
does. It needs `@plutocms/core` 0.75.0 or newer.

```ts [nuxt.config.ts]
export default defineNuxtConfig({
  extends: ['@plutocms/core', '@plutocms/forms'],
})
```

Adding the layer is the opt-in: the `form` type exists, the field blocks exist, and the submit
route works. With the Git CMS the forms are files in `content/forms/<handle>.md`.

## Make a form

In the admin, open **Forms**, add a form, and add field blocks. The side panel has the title, the
handle (for example `contact`), who gets the email, the subject, the message after sending, a page to
open after sending, and how many days to keep the submissions.

Show the form on a page, a post or an area with the block:

```md
::pluto-form{form="contact"}
::
```

Or in a template:

```vue
<PlutoForm handle="contact" />
```

## Set up the site

A form works when the site has three things. The page **Settings > Forms** shows the state of each
one, with steps for Vercel, Netlify, Cloudflare and your own server.

| Need                      | What to set                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------ |
| A store for the submissions | `plutoForms: { storage: 'forms' }` and a `nitro.storage.forms` mount (any driver). |
| A signing secret            | `NUXT_PLUTO_FORMS_SECRET`. The Git CMS makes one from its session password.        |
| Email                       | The mail setup of Pluto (`Settings > Email`).                                       |
| Turnstile (optional)        | `NUXT_PLUTO_FORMS_TURNSTILE_SITE_KEY` and `NUXT_PLUTO_FORMS_TURNSTILE_SECRET`.      |

```ts [nuxt.config.ts]
export default defineNuxtConfig({
  nitro: {
    storage: {
      forms: { driver: 'upstash' },
    },
  },
  plutoForms: {
    storage: 'forms',
  },
})
```

In production, with no store, the submit route answers `503`. In development, with no `storage`
option, the layer keeps the submissions in `.data/pluto-forms`.

Other options of `plutoForms`: `minFillSeconds` (default 3) and `rateLimit` (submissions for each IP
in one minute, default 5).

## Define a form in code

```ts [app/app.config.ts]
export default defineAppConfig({
  plutoForms: {
    forms: [
      definePlutoForm({
        handle: 'newsletter',
        title: 'Newsletter',
        fields: [
          { name: 'email', type: 'email', label: 'Email', required: true },
          { name: 'consent', type: 'consent', label: 'I agree', required: true },
        ],
        submitLabel: 'Subscribe',
        settings: { recipients: ['team@example.com'], retentionDays: 90 },
      }),
    ],
  },
})
```

The `forms` lists of the app and of its layers join. The structure of a code form is read-only in the
admin. A `form` item of the admin with the same handle changes the title and the settings. A code form
shows in **Submissions** with a badge.

## Draw it your way

`usePlutoForm(handle)` gives `fields`, `values`, `errors`, `status`, `message` and `submit()`.
It validates in the browser with the same code as the server.

```vue
<script setup lang="ts">
const { fields, values, errors, status, message, honeypot, submit } =
  usePlutoForm('contact')
</script>

<template>
  <form novalidate @submit.prevent="submit()">
    <label v-for="field in fields" :key="field.name">
      {{ field.label }}
      <input v-model="values[field.name]" :name="field.name" />
      <span v-if="errors[field.name]">{{ errors[field.name] }}</span>
    </label>

    <input v-model="honeypot" name="hp" tabindex="-1" autocomplete="off" hidden />
    <button :disabled="status === 'submitting'">Send</button>

    <p aria-live="polite">{{ message }}</p>
  </form>
</template>
```

To change the default markup, add a component with the name of a field component to the app:
`PlutoFormInput`, `PlutoFormTextarea`, `PlutoFormSelect`, `PlutoFormRadio`, `PlutoFormCheckbox`,
`PlutoFormConsent`, `PlutoFormHidden` or `PlutoFormSubmit`. The app wins over the layer. Each field
component gets `field`, `modelValue`, `error`, `id` and `disabled`, and emits `update:modelValue`.

## Add a field type

```ts [app/app.config.ts]
export default defineAppConfig({
  plutoForms: {
    fieldTypes: [
      definePlutoFormField({
        name: 'rating',
        block: 'form-rating',
        component: 'RatingField',
        validate: (value) =>
          Number(value) >= 1 && Number(value) <= 5 ? undefined : 'Pick 1 to 5.',
      }),
    ],
  },
})
```

Add the block `app/components/content/FormRating.vue` (a content component with `definePlutoBlock`,
`hidden: true`, and `usePlutoFormBlockField('form-rating', props)` to draw it), and the field
component `app/components/global/RatingField.vue`. The block shows in the form editor, the server
validates the value with `validate`, and the form draws `RatingField`.

## Hook the server

```ts [server/plugins/forms.ts]
export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('pluto:forms:before-store', (context) => {
    if (JSON.stringify(context.values).includes('http://')) {
      context.reject('Please remove the links.')
    }
  })

  nitro.hooks.hook('pluto:forms:submission', async (context) => {
    await fetch('https://example.com/hook', {
      method: 'POST',
      body: JSON.stringify({ form: context.form.handle, values: context.values }),
    })
  })
})
```

`pluto:forms:before-store` runs before the store keeps the submission. `context.reject(message)`
refuses it, and the visitor sees the message. `pluto:forms:submission` runs after the store and the
email. A failure in it is logged, and the visitor still sees the success message.

## A store from a backend layer

```ts
registerFormStore({
  id: 'my-store',
  add: async (input) => { /* ... */ },
  list: async (form, { limit, offset }) => { /* ... */ },
  get: async (form, id) => { /* ... */ },
  delete: async (form, id) => { /* ... */ },
  purge: async (form, olderThan) => { /* ... */ },
})
```

A registered store wins over `plutoForms.storage`. The test helper `describeFormStoreContract`
(`test/store-contract.ts`) checks the behavior that every store needs.

## Retention

The task `pluto:forms:purge` runs every day at 03:30 and deletes the submissions that are older than the
`retentionDays` of each form (0 keeps them). Like the other Pluto tasks, it needs a host that runs
Nitro scheduled tasks.

## Permissions

| Capability                | What it allows                                              |
| ------------------------- | ----------------------------------------------------------- |
| `forms:write`             | Make, edit and delete forms.                                |
| `forms:read_submissions`  | See, export and delete submissions.                         |

An admin has both. The email addresses of a form never reach the public API.

See the skill `.claude/skills/forms/SKILL.md` of the repository for the internals.

// @ts-check
import antfu from '@antfu/eslint-config'
import { createConfigForNuxt } from '@nuxt/eslint-config/flat'
import prettier from 'eslint-config-prettier'
import betterTailwindcss from 'eslint-plugin-better-tailwindcss'
import { getDefaultSelectors } from 'eslint-plugin-better-tailwindcss/defaults'

// The Nuxt rules come from @nuxt/eslint-config, not from the @nuxt/eslint module. A module in a
// layer runs in every app that extends the layer.
// See: https://eslint.vuejs.org/rules
export default createConfigForNuxt({
  features: {
    standalone: false,
    nuxt: { sortConfigKeys: true },
  },
  dirs: {
    src: ['app'],
  },
}).append(
  // @ts-ignore
  antfu({
    // Prettier formats the code (format on save, `bun run prettier`). ESLint checks the code,
    // not its layout, so the two never undo each other.
    stylistic: false,
    ignores: ['**/*.md'],

    rules: {
      'node/prefer-global/process': ['off', 'never'],

      'vue/block-order': [
        'warn',
        {
          order: ['script', 'template', 'style'],
        },
      ],

      'vue/html-self-closing': [
        'warn',
        {
          html: {
            void: 'always',
            normal: 'always',
            component: 'always',
          },
          svg: 'always',
          math: 'always',
        },
      ],

      'vue/attributes-order': [
        'warn',
        {
          order: [
            'DEFINITION',
            'LIST_RENDERING',
            'CONDITIONALS',
            'RENDER_MODIFIERS',
            'GLOBAL',
            'UNIQUE',
            'TWO_WAY_BINDING',
            'SLOT',
            'OTHER_DIRECTIVES',
            'ATTR_DYNAMIC',
            'ATTR_STATIC',
            'ATTR_SHORTHAND_BOOL',
            'EVENTS',
            'CONTENT',
          ],
        },
      ],

      'vue/multi-word-component-names': 'off',

      'vue/eqeqeq': ['error', 'always'],
    },
  }),
  // Canonical Tailwind classes (the same suggestion as Tailwind IntelliSense,
  // `suggestCanonicalClasses`): `w-px`, not `w-[1px]`. The design system is
  // tailwind.lint.css. Nuxt UI `ui` objects (`:ui="{ root: '…' }"`) count too.
  {
    files: ['**/*.vue', '**/*.ts'],
    plugins: { 'better-tailwindcss': betterTailwindcss },
    settings: {
      'better-tailwindcss': {
        entryPoint: 'tailwind.lint.css',
        // px arbitrary values become spacing steps (`h-[27px]` is `h-6.75`).
        rootFontSize: 16,
        selectors: [
          ...getDefaultSelectors(),
          {
            kind: 'attribute',
            name: '^(?:v-bind:)?ui$',
            match: [{ type: 'objectValues' }],
          },
        ],
      },
    },
    rules: {
      'better-tailwindcss/enforce-canonical-classes': 'error',
      // The fix of the rule above can leave double spaces in a class list.
      'better-tailwindcss/no-unnecessary-whitespace': 'error',
    },
  },
  // Last: turns off every rule that Prettier covers (the Vue template layout rules too).
  prettier
)

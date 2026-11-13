// @ts-check
import antfu from '@antfu/eslint-config'
import { createConfigForNuxt } from '@nuxt/eslint-config/flat'
import prettier from 'eslint-config-prettier'
import betterTailwindcss from 'eslint-plugin-better-tailwindcss'
import { getDefaultSelectors } from 'eslint-plugin-better-tailwindcss/defaults'

export default createConfigForNuxt({
  features: {
    standalone: false,
    nuxt: { sortConfigKeys: true },
  },
  dirs: {
    src: [
      'packages/core/app',
      'packages/layers/addons/3d/app',
      'packages/layers/addons/shop/app',
      'packages/layers/addons/seo/app',
      'playground/app',
    ],
  },
}).append(
  { ignores: ['**/*.md', '.agents/**/*'] },
  antfu({
    // Prettier owns the layout.
    stylistic: false,
    rules: {
      'antfu/consistent-chaining': 'off',

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

      'vue/prefer-separate-static-class': 'off',

      curly: ['warn', 'all'],

      'unicorn/number-literal-case': 'off',
    },
  }),
  {
    files: ['**/*.vue', '**/*.ts'],
    plugins: { 'better-tailwindcss': betterTailwindcss },
    settings: {
      'better-tailwindcss': {
        entryPoint: 'packages/core/tailwind.lint.css',
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
      'better-tailwindcss/no-unnecessary-whitespace': 'error',
    },
  },
  prettier
)

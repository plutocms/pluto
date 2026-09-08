// @ts-check
import antfu from '@antfu/eslint-config'
import withNuxt from './.nuxt/eslint.config.mjs'

// See: https://eslint.vuejs.org/rules
export default withNuxt(
  { ignores: ['**/*.md', '.agents/**/*'] },
  antfu({
    rules: {
      'antfu/consistent-chaining': 'off',

      'node/prefer-global/process': ['off', 'never'],

      'style/arrow-parens': ['warn', 'always'],

      'style/brace-style': ['warn', '1tbs'],

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

      'style/comma-dangle': [
        'warn',
        {
          arrays: 'always-multiline',
          objects: 'always-multiline',
          imports: 'always-multiline',
          exports: 'always-multiline',
          functions: 'never',
          enums: 'always-multiline',
          generics: 'always-multiline',
          tuples: 'always-multiline',
        },
      ],

      'vue/comma-dangle': [
        'warn',
        {
          arrays: 'always-multiline',
          objects: 'always-multiline',
          imports: 'always-multiline',
          exports: 'always-multiline',
          functions: 'never',
        },
      ],

      'style/operator-linebreak': 'off',

      'style/no-mixed-operators': 'off',

      'style/indent': 'off',

      'vue/singleline-html-element-content-newline': 'off',
      'vue/prefer-separate-static-class': 'off',

      'curly': ['warn', 'all'],

      'style/quote-props': ['warn', 'consistent'],

      'style/object-curly-newline': [
        'warn',
        {
          TSTypeLiteral: { minProperties: 1 },
        },
      ],
      'vue/operator-linebreak': 'off',
      'vue/html-indent': 'off',
      'vue/brace-style': 'off',
      'style/indent-binary-ops': 'off',

      'unicorn/number-literal-case': 'off',
    },
  })
)

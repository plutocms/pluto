/**
 * The languages of the code block menu of the Visual editor: the value is the info of the fence
 * (```typescript), and lowlight colors it (the `common` grammars, with their aliases: `ts` works
 * too). `aliases` are the short names of a fence (`ts`): the menu shows them as their language, and
 * keeps the name that the author wrote. Sorted by label.
 */
export const PLUTO_CODE_LANGUAGES: ReadonlyArray<{
  label: string
  value: string
  aliases?: string[]
}> = [
  { label: 'Bash', value: 'bash', aliases: ['sh', 'zsh'] },
  { label: 'C', value: 'c', aliases: ['h'] },
  { label: 'C#', value: 'csharp', aliases: ['cs'] },
  { label: 'C++', value: 'cpp', aliases: ['c++', 'cc', 'hpp'] },
  { label: 'CSS', value: 'css' },
  { label: 'Diff', value: 'diff', aliases: ['patch'] },
  { label: 'Go', value: 'go', aliases: ['golang'] },
  { label: 'GraphQL', value: 'graphql', aliases: ['gql'] },
  { label: 'HTML', value: 'html', aliases: ['htm', 'vue'] },
  { label: 'Java', value: 'java' },
  {
    label: 'JavaScript',
    value: 'javascript',
    aliases: ['js', 'jsx', 'mjs', 'cjs'],
  },
  { label: 'JSON', value: 'json', aliases: ['jsonc'] },
  { label: 'Kotlin', value: 'kotlin', aliases: ['kt'] },
  { label: 'Markdown', value: 'markdown', aliases: ['md'] },
  { label: 'PHP', value: 'php' },
  { label: 'Python', value: 'python', aliases: ['py'] },
  { label: 'Ruby', value: 'ruby', aliases: ['rb'] },
  { label: 'Rust', value: 'rust', aliases: ['rs'] },
  { label: 'SCSS', value: 'scss' },
  { label: 'Shell', value: 'shell', aliases: ['console'] },
  { label: 'SQL', value: 'sql' },
  { label: 'Swift', value: 'swift' },
  {
    label: 'TypeScript',
    value: 'typescript',
    aliases: ['ts', 'tsx', 'mts', 'cts'],
  },
  { label: 'XML', value: 'xml', aliases: ['svg'] },
  { label: 'YAML', value: 'yaml', aliases: ['yml'] },
]

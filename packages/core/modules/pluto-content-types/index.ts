import type { Unimport } from 'unimport'
import type { DeclaredContentType } from './scan'
import { readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { addTypeTemplate, defineNuxtModule, updateTemplates } from '@nuxt/kit'
import { contentTypeExports, contentTypesTemplate } from './scan'

const FILENAME = 'types/pluto-content-types.d.ts'

/**
 * The item types of the content types of the app, with no interface to write. The module reads
 * the auto-imports of the app and its layers, finds each `export const x = defineContentType(...)`,
 * and writes `#build/types/pluto-content-types.d.ts`: it adds each type to the global
 * `PlutoContentTypes` map under its `name`. Then `usePlutoSingleton('contact')` knows its item, and
 * `PlutoItem<'contact'>` names it. See the content-model skill ("Item types").
 */
export default defineNuxtModule({
  meta: { name: 'pluto-content-types' },
  setup(_options, nuxt) {
    let imports: Unimport | undefined
    nuxt.hook('imports:context', (context) => {
      imports = context
    })

    async function declaredTypes(): Promise<DeclaredContentType[]> {
      if (!imports) {
        return []
      }
      const files = new Set<string>()
      for (const entry of await imports.getImports()) {
        if (/\.[cm]?ts$/.test(entry.from)) {
          files.add(entry.from)
        }
      }
      const declared: DeclaredContentType[] = []
      for (const file of [...files].sort()) {
        let text: string
        try {
          text = await readFile(file, 'utf8')
        } catch {
          continue
        }
        if (!text.includes('defineContentType')) {
          continue
        }
        for (const exportName of contentTypeExports(text)) {
          declared.push({ exportName, file })
        }
      }
      return declared
    }

    const typesDir = join(nuxt.options.buildDir, 'types')
    addTypeTemplate(
      {
        filename: FILENAME,
        getContents: async () =>
          contentTypesTemplate(await declaredTypes(), (file) => {
            const path = relative(typesDir, file)
              .replace(/\\/g, '/')
              .replace(/\.[cm]?ts$/, '')
            return path.startsWith('.') ? path : `./${path}`
          }),
      },
      { nuxt: true, nitro: true, shared: true }
    )

    // A new or changed declaration in dev: write the types again.
    nuxt.hook('builder:watch', async (_event, path) => {
      if (
        /\.[cm]?ts$/.test(path) &&
        /(?:^|[/\\])(?:shared|utils)[/\\]/.test(path)
      ) {
        await updateTemplates({
          filter: (template) => template.filename === FILENAME,
        })
      }
    })
  },
})

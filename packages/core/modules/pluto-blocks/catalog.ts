import type { PlutoComponentMeta } from '../../shared/utils/blocks/component-meta'
import type {
  PlutoBlockPatch,
  PlutoBlocksConfig,
} from '../../shared/utils/blocks/definition'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import {
  blockFromComponentMeta,
  componentBlockName,
} from '../../shared/utils/blocks/component-meta'

export const BLOCK_MACRO = 'definePlutoBlock'

export const MACRO_KEY = 'pluto'

export const CONTENT_COMPONENTS_DIR = 'components/content'

export interface BlockFile {
  name: string
  file: string
}

export type ParsedComponent = PlutoComponentMeta & {
  [MACRO_KEY]?: PlutoBlockPatch
}

export type MetaReader = (file: string) => ParsedComponent

export interface BlockEntry {
  hash: string
  block?: { name: string; definition: PlutoBlockPatch }
  warnings: string[]
  ms: number
}

export interface BlockLog {
  warn: (message: string) => void
  debug: (message: string) => void
}

export function hasBlockMacro(text: string): boolean {
  return /\bdefinePlutoBlock\s*[(<]/.test(text)
}

export function findContentComponents(dirs: string[]): BlockFile[] {
  const found = new Map<string, BlockFile>()
  const visit = (dir: string) => {
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        visit(path)
        continue
      }
      if (!entry.name.endsWith('.vue')) {
        continue
      }
      const name = basename(entry.name, '.vue')
      if (
        name.startsWith('Prose') ||
        name.endsWith('.client') ||
        name.endsWith('.server') ||
        found.has(name)
      ) {
        continue
      }
      found.set(name, { name, file: path })
    }
  }
  for (const dir of dirs) {
    visit(dir)
  }
  return [...found.values()]
}

function hashOf(text: string): string {
  return createHash('sha1').update(text).digest('hex')
}

export function readBlockEntry(
  { name, file }: BlockFile,
  text: string,
  read: MetaReader,
  now: () => number = Date.now
): BlockEntry {
  const hash = hashOf(text)
  if (!hasBlockMacro(text)) {
    return { hash, warnings: [], ms: 0 }
  }
  const start = now()
  let parsed: ParsedComponent
  try {
    parsed = read(file)
  } catch (error) {
    return {
      hash,
      warnings: [
        `${BLOCK_MACRO} in ${file} was skipped. The component did not parse: ${error instanceof Error ? error.message : String(error)}`,
      ],
      ms: now() - start,
    }
  }
  const ms = now() - start
  const macro = parsed[MACRO_KEY]
  if (!macro) {
    return {
      hash,
      warnings: [
        `${BLOCK_MACRO} in ${file} was skipped. Its argument must be an object literal that does not use a local variable. It can use a constant imported from a file.`,
      ],
      ms,
    }
  }
  const { [MACRO_KEY]: _macro, ...meta } = parsed
  return {
    hash,
    block: blockFromComponentMeta(name, pickMeta(meta), macro),
    warnings: [],
    ms,
  }
}

function pickMeta(meta: ParsedComponent): PlutoComponentMeta {
  return { props: meta.props, slots: meta.slots }
}

export class BlockCatalog {
  private cache = new Map<string, BlockEntry>()

  constructor(
    private dirs: () => string[],
    private read: MetaReader,
    private log: BlockLog,
    private now: () => number = Date.now
  ) {}

  collect(): PlutoBlocksConfig {
    const start = this.now()
    const files = findContentComponents(this.dirs())
    const result: PlutoBlocksConfig = {}
    const seen = new Set<string>()
    let parsed = 0
    for (const item of files) {
      seen.add(item.file)
      let text: string
      try {
        text = readFileSync(item.file, 'utf8')
      } catch {
        continue
      }
      let entry = this.cache.get(item.file)
      if (!entry || entry.hash !== hashOf(text)) {
        entry = readBlockEntry(item, text, this.read, this.now)
        this.cache.set(item.file, entry)
        for (const warning of entry.warnings) {
          this.log.warn(warning)
        }
        if (entry.block) {
          parsed++
          this.log.debug(`${item.name}: ${entry.ms} ms`)
        }
      }
      if (entry.block) {
        result[entry.block.name] = entry.block.definition
      }
    }
    for (const file of this.cache.keys()) {
      if (!seen.has(file)) {
        this.cache.delete(file)
      }
    }
    if (parsed > 0) {
      this.log.debug(
        `Read ${parsed} block component(s) in ${this.now() - start} ms.`
      )
    }
    return result
  }
}

export function blocksModuleSource(blocks: PlutoBlocksConfig): string {
  return `export default ${JSON.stringify(blocks)}\n`
}

export function blockComponentFiles(dirs: string[]): BlockFile[] {
  const files: BlockFile[] = []
  for (const item of findContentComponents(dirs)) {
    let text: string
    try {
      text = readFileSync(item.file, 'utf8')
    } catch {
      continue
    }
    if (hasBlockMacro(text)) {
      files.push({ name: componentBlockName(item.name), file: item.file })
    }
  }
  return files
}

export function componentsModuleSource(files: BlockFile[]): string {
  const entries = files.map(
    ({ name, file }) =>
      `  ${JSON.stringify(name)}: () => import(${JSON.stringify(file)}),`
  )
  return `export default {\n${entries.join('\n')}\n}\n`
}

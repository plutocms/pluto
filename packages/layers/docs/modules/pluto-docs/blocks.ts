// Find the block components of a site and read their definitions at build time.
// A component is a block only when its file calls `definePlutoBlock(...)`. The props and slots come
// from the TypeScript meta (`nuxt-component-meta`), the label, icon and more from the call.
// This file has no Nuxt import, so plain Vitest tests it.

import type { PlutoComponentMeta } from '../../shared/utils/blocks/component-meta'
import type {
  PlutoBlockPatch,
  PlutoBlocksConfig,
} from '../../shared/utils/blocks/types'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { blockFromComponentMeta } from '../../shared/utils/blocks/component-meta'

/** The name of the macro. A component file calls it in `<script setup>`. */
export const BLOCK_MACRO = 'definePlutoBlock'

/** The key of the macro argument in the output of the parser. */
export const MACRO_KEY = 'pluto'

/** The folder of the components that Nuxt Content renders, in the app and in each layer. */
export const CONTENT_COMPONENTS_DIR = 'components/content'

export interface BlockFile {
  /** The component name in Pascal case: `PlutoHero`. */
  name: string
  file: string
}

/** The output of the parser, with the macro argument under `pluto`. */
export type ParsedComponent = PlutoComponentMeta & {
  [MACRO_KEY]?: PlutoBlockPatch
}

export type MetaReader = (file: string) => ParsedComponent

export interface BlockEntry {
  /** The hash of the file text. The entry is valid while the hash is the same. */
  hash: string
  block?: { name: string; definition: PlutoBlockPatch }
  warnings: string[]
  /** The time of the parse, in milliseconds. 0 when the entry came from the cache. */
  ms: number
}

export interface BlockLog {
  warn: (message: string) => void
  debug: (message: string) => void
}

/** Whether the file text calls the macro: `definePlutoBlock(...)` or `definePlutoBlock<Props>(...)`. */
export function hasBlockMacro(text: string): boolean {
  return /\bdefinePlutoBlock\s*[(<]/.test(text)
}

/**
 * The component files of the `components/content` folders. The folders come in order of priority
 * (the app first, then its layers). When two files have the same name, the first one wins. A
 * `Prose*` file is a prose override, an `.client` or `.server` file is a variant: none is a block.
 */
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

/**
 * Read the block of one component file. A file without the macro gives an entry with no block, and
 * the parser does not run. A parse error gives a warning and no block. A macro that the parser
 * cannot evaluate (for example, an argument that uses a local variable) gives a warning and no
 * block: a half-read definition would hide the mistake.
 */
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
  // The key is not a block field. The meta is only props and slots.
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

/**
 * The component layer of a site: the blocks of the component files, with a cache by file. A file
 * is parsed again only when its text changed. Call `collect` for each build and each hot update.
 */
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

/** The source of the Vite virtual module for a component layer. */
export function blocksModuleSource(blocks: PlutoBlocksConfig): string {
  return `export default ${JSON.stringify(blocks)}\n`
}

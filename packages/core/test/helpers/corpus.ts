import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

export const CORPUS_ROOT = join(__dirname, '..', 'fixtures', 'mdc')

function walk(folder: string): string[] {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name)
    return statSync(path).isDirectory()
      ? walk(path)
      : name.endsWith('.md')
        ? [path]
        : []
  })
}

export function corpusFiles(): string[] {
  return walk(CORPUS_ROOT)
}

export function bodyOf(text: string): string {
  const match = /^---\r?\n[\s\S]*?\r?\n---\r?\n/.exec(text)
  return match ? text.slice(match[0].length) : text
}

export function corpusBodies(): Array<{ file: string; body: string }> {
  return corpusFiles().map((file) => ({
    file: file.slice(CORPUS_ROOT.length),
    body: bodyOf(readFileSync(file, 'utf8')),
  }))
}

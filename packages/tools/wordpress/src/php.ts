export type PhpValue =
  null | boolean | number | string | PhpValue[] | { [key: string]: PhpValue }

class Reader {
  private index = 0

  constructor(private readonly source: string) {}

  until(delimiter: string): string {
    const end = this.source.indexOf(delimiter, this.index)

    if (end < 0) {
      throw new Error(`PHP value is not valid at ${this.index}`)
    }

    const value = this.source.slice(this.index, end)
    this.index = end + delimiter.length

    return value
  }

  skip(count: number) {
    this.index += count
  }

  peek(): string {
    return this.source[this.index] ?? ''
  }

  bytes(length: number): string {
    let taken = 0
    let end = this.index

    while (taken < length && end < this.source.length) {
      const code = this.source.codePointAt(end) ?? 0

      taken += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4
      end += code > 0xffff ? 2 : 1
    }

    const value = this.source.slice(this.index, end)
    this.index = end

    return value
  }
}

function readValue(reader: Reader): PhpValue {
  const type = reader.peek()

  reader.skip(2)

  switch (type) {
    case 'N':
      return null
    case 'b':
      return reader.until(';') === '1'
    case 'i':
    case 'd':
      return Number(reader.until(';'))
    case 's': {
      const length = Number(reader.until(':'))

      reader.skip(1)

      const value = reader.bytes(length)

      reader.skip(2)

      return value
    }
    case 'a':
      return readArray(reader)
    case 'O': {
      reader.until(':')
      reader.until(':')

      return readArray(reader)
    }
    default:
      throw new Error(`PHP type "${type}" is not supported`)
  }
}

function readArray(reader: Reader): PhpValue {
  const count = Number(reader.until(':'))

  reader.skip(1)

  const entries: [string, PhpValue][] = []

  for (let index = 0; index < count; index++) {
    const key = readValue(reader)
    const value = readValue(reader)

    entries.push([String(key), value])
  }

  reader.skip(1)

  const isList = entries.every(([key], index) => key === String(index))

  return isList
    ? entries.map(([, value]) => value)
    : Object.fromEntries(entries)
}

/**
 * Reads a PHP-serialized value, as WordPress stores the settings of a post meta.
 * Arrays with keys 0, 1, 2... become lists. Other arrays and objects become plain objects.
 * @see https://www.php.net/manual/en/function.unserialize.php
 */
export function unserialize(source: string): PhpValue {
  return readValue(new Reader(source))
}

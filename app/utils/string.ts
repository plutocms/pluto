import { kebabCase } from 'change-case'

export function fileNameToKebabCase(name: string) {
  const fileName = name.replace(/(.*)(\.\w+$)/, `$1`)
  const fileExtension = name.replace(/(.*)(\.\w+$)/, `$2`)

  return `${encodeURIComponent(kebabCase(fileName))}${fileExtension}`
}

export function slugify(text: string) {
  return kebabCase(text.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
}

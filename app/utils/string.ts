import { kebabCase } from 'change-case'

export function fileNameToKebabCase(name: string) {
  const fileName = name.replace(/(.*)(\.\w+$)/, `$1`)
  const fileExtension = name.replace(/(.*)(\.\w+$)/, `$2`)

  return `${encodeURIComponent(kebabCase(fileName))}${fileExtension}`
}

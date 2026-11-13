export const PLUTO_LINK_BLANK = '{target="_blank"}'

export const PLUTO_LINK_BLANK_REL = 'noopener noreferrer'

const BLANK_LINK =
  /^(\[(?:\\.|[^\\\]])*\]\([^()\s]*(?:\s+"[^"]*")?\))\{target="_blank"\}/

const BLANK_LINK_ANYWHERE = /\]\([^()\s]*(?:\s+"[^"]*")?\)\{target="_blank"\}/g

const BLANK_TARGET = /(?:^|\s)target\s*=\s*(?:"_blank"|'_blank'|_blank)(?:\s|$)/

export function matchBlankLink(
  src: string
): { raw: string; link: string } | undefined {
  const match = BLANK_LINK.exec(src)
  return match ? { raw: match[0], link: match[1]! } : undefined
}

export function withoutBlankLinkAttributes(line: string): string {
  return line.replace(BLANK_LINK_ANYWHERE, (match) =>
    match.slice(0, -PLUTO_LINK_BLANK.length)
  )
}

export function hasBlankTarget(attributes: string): boolean {
  return BLANK_TARGET.test(attributes)
}

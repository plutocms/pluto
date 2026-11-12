// A link that opens in a new tab, in Markdown: the MDC attribute after the link,
// `[text](https://example.com){target="_blank"}`. Nuxt Content reads it natively. The Visual editor
// writes exactly this form (the "Open in a new tab" box of the link popover), the public renderer
// and the editor read it, and it does not lock a post to the Markdown mode.

/** The attribute the editor writes after a link. */
export const PLUTO_LINK_BLANK = '{target="_blank"}'

/** `rel` of a link that opens in a new tab: the new page gets no handle on this one. */
export const PLUTO_LINK_BLANK_REL = 'noopener noreferrer'

const BLANK_LINK =
  /^(\[(?:\\.|[^\\\]])*\]\([^()\s]*(?:\s+"[^"]*")?\))\{target="_blank"\}/

const BLANK_LINK_ANYWHERE =
  /\]\([^()\s]*(?:\s+"[^"]*")?\)\{target="_blank"\}/g

const BLANK_TARGET = /(?:^|\s)target\s*=\s*(?:"_blank"|'_blank'|_blank)(?:\s|$)/

/**
 * A link with the new tab attribute at the start of `src`: the whole match (`raw`) and the link
 * alone (`link`, `[text](href "title")`), else `undefined`.
 */
export function matchBlankLink(
  src: string
): { raw: string; link: string } | undefined {
  const match = BLANK_LINK.exec(src)
  return match ? { raw: match[0], link: match[1]! } : undefined
}

/** `line` with each new tab attribute after a link removed (`[a](b){target="_blank"}` to `[a](b)`). */
export function withoutBlankLinkAttributes(line: string): string {
  return line.replace(BLANK_LINK_ANYWHERE, (match) =>
    match.slice(0, -PLUTO_LINK_BLANK.length)
  )
}

/** Whether the attributes of an MDC `{…}` block ask for a new tab (`target="_blank"`, `target=_blank`). */
export function hasBlankTarget(attributes: string): boolean {
  return BLANK_TARGET.test(attributes)
}

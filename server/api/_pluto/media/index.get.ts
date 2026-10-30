/** The media library: a page (`limit`, `offset`, `search`, `type`), or the records of `ids`. Needs `media:manage`. See the media skill. */
export default defineEventHandler((event) => listMedia(event))

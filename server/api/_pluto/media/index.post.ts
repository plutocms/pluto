/** Uploads one file (multipart: `file`, `alt`). Core checks it and makes the record. Needs `media:manage`. */
export default defineEventHandler((event) => uploadMedia(event))

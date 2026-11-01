import {
  createError,
  defineEventHandler,
  getRouterParam,
  setResponseHeaders,
} from 'h3'
import { githubMediaContentType, githubMediaPath } from '../media'
import {
  getRegisteredGithubStore,
  markGithubAnonymous,
} from '../utils/github-setup'

/**
 * Route: GET /media/**. A media file of the Git CMS, read from the repo.
 * After a deploy, the host sends the static file first, so this route only
 * answers for a file that is in the repo but not in a deploy yet (a content
 * commit can skip the deploy). A stored file name never changes, so the
 * answer can be cached for ever. See the media skill.
 */
export default defineEventHandler(async (event) => {
  const path = githubMediaPath(getRouterParam(event, '_') ?? '')
  const store = getRegisteredGithubStore()
  if (!path || !store) {
    throw createError({ statusCode: 404, statusMessage: 'Not found.' })
  }
  markGithubAnonymous(event)
  const bytes = await store.readRaw(`public/media/${path}`)
  if (!bytes) {
    throw createError({ statusCode: 404, statusMessage: 'Not found.' })
  }
  setResponseHeaders(event, {
    'Content-Type': githubMediaContentType(path),
    'Cache-Control': 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
  })
  return bytes
})

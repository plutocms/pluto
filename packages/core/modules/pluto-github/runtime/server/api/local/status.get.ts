import { defineEventHandler } from 'h3'
import { handleLocalGitStatus } from '../../utils/local-git-routes'

/** Route: GET /api/_pluto/github/local/status. Local mode only. */
export default defineEventHandler(handleLocalGitStatus)

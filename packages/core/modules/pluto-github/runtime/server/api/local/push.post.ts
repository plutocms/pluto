import { defineEventHandler } from 'h3'
import { handleLocalGitPush } from '../../utils/local-git-routes'

/** Route: POST /api/_pluto/github/local/push. Local mode only. */
export default defineEventHandler(handleLocalGitPush)

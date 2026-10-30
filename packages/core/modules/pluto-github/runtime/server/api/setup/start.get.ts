import { defineEventHandler } from 'h3'
import { handleSetupStart } from '../../utils/github-setup-flow'

/** Route: GET /api/_pluto/github/setup/start. Posts the App manifest to GitHub. */
export default defineEventHandler(handleSetupStart)

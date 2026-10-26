import { defineEventHandler } from 'h3'
import { handleSetupStart } from '../../../utils/cms-setup-flow'

/** Route: GET /api/_pluto/cms/setup/github/start. Posts the App manifest to GitHub. */
export default defineEventHandler(handleSetupStart)

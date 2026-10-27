import { defineEventHandler } from 'h3'
import { handleSetupStatus } from '../../utils/github-setup-flow'

/** Route: GET /api/_pluto/github/setup/status. The checks of the GitHub sign-in. Booleans only. */
export default defineEventHandler(handleSetupStatus)

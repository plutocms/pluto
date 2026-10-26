import { defineEventHandler } from 'h3'
import { handleSetupStatus } from '../../utils/cms-setup-flow'

/** Route: GET /api/_pluto/cms/setup/status. The checks of the GitHub sign-in. Booleans only. */
export default defineEventHandler(handleSetupStatus)

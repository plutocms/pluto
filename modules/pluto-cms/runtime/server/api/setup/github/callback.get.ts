import { defineEventHandler } from 'h3'
import { handleSetupCallback } from '../../../utils/cms-setup-flow'

/** Route: GET /api/_pluto/cms/setup/github/callback. Trades the code for the new GitHub App. */
export default defineEventHandler(handleSetupCallback)

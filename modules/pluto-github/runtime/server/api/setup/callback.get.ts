import { defineEventHandler } from 'h3'
import { handleSetupCallback } from '../../utils/github-setup-flow'

/** Route: GET /api/_pluto/github/setup/callback. Trades the code for the new GitHub App. */
export default defineEventHandler(handleSetupCallback)

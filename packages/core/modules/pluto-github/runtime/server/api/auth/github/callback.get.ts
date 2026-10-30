import { defineEventHandler } from 'h3'
import { handleCallback } from '../../../utils/auth-flow'

/** Route: GET /api/_pluto/auth/github/callback. Ends the GitHub sign-in. */
export default defineEventHandler(handleCallback)

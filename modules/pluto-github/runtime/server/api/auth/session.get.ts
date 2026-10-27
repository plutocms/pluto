import { defineEventHandler } from 'h3'
import { handleSession } from '../../utils/auth-flow'

/** Route: GET /api/_pluto/auth/session. Tells the browser who is signed in. */
export default defineEventHandler(handleSession)

import { defineEventHandler } from 'h3'
import { handleLogout } from '../../utils/auth-flow'

/** Route: POST /api/_pluto/auth/logout. Ends the session. */
export default defineEventHandler(handleLogout)

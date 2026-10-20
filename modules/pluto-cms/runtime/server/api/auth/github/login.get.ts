import { defineEventHandler } from 'h3'
import { handleLogin } from '../../../utils/auth-flow'

/** Route: GET /api/_pluto/auth/github/login. Starts the GitHub sign-in. */
export default defineEventHandler(handleLogin)

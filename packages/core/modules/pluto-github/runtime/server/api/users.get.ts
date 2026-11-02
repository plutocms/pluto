import { defineEventHandler } from 'h3'
import { handleGithubUsers } from '../utils/github-users'

/** Route: GET /api/_pluto/github/users. The people with write access to the repo. */
export default defineEventHandler(handleGithubUsers)

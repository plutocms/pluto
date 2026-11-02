import { defineEventHandler } from 'h3'
import { handleDeployStatus } from '../../utils/deploy'

/** Route: GET /api/_pluto/github/deploy/status. The facts of the Deploy page. */
export default defineEventHandler(handleDeployStatus)

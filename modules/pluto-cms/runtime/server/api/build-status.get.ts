import { defineEventHandler } from 'h3'
import { handleBuildStatus } from '../utils/build-status'

/** Route: GET /api/_pluto/cms/build-status. The build status of the head commit. */
export default defineEventHandler(handleBuildStatus)

import { defineEventHandler } from 'h3'
import { handleSetupPages } from '../../utils/deploy'

/** Route: POST /api/_pluto/github/deploy/pages. Local mode only: writes and commits the Pages workflow. */
export default defineEventHandler(handleSetupPages)

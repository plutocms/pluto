import { defineEventHandler } from 'h3'
import { handleSetupPages } from '../../utils/deploy'

/** Route: POST /api/_pluto/github/deploy/pages. Local mode only: the Pages workflow and gh. */
export default defineEventHandler(handleSetupPages)

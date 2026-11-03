import { defineEventHandler } from 'h3'
import { handleRemovePages } from '../../utils/deploy'

/** Route: DELETE /api/_pluto/github/deploy/pages. Local mode only: deletes and commits the Pages workflow. */
export default defineEventHandler(handleRemovePages)

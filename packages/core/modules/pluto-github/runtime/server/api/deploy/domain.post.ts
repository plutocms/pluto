import { defineEventHandler } from 'h3'
import { handlePagesDomain } from '../../utils/deploy'

/** Route: POST /api/_pluto/github/deploy/domain. Local mode only: the custom domain of GitHub Pages, with gh. */
export default defineEventHandler(handlePagesDomain)

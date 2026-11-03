import { defineEventHandler } from 'h3'
import { handleDomainCheck } from '../../utils/deploy'

/** Route: GET /api/_pluto/github/deploy/dns. Checks the DNS of a custom domain for GitHub Pages. */
export default defineEventHandler(handleDomainCheck)

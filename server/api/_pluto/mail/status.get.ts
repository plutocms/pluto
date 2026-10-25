import { mailStatus } from '../../../mail/handlers'

/** The mail setup status. Admin only. See the mail skill. */
export default defineEventHandler((event) => mailStatus(event))

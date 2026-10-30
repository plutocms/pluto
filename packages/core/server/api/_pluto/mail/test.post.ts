import { mailTest } from '../../../mail/handlers'

/** Sends a test email. Admin only. 5 calls in 10 minutes for each admin. */
export default defineEventHandler((event) => mailTest(event))

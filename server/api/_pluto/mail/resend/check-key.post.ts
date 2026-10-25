import { mailCheckKey } from '../../../../mail/handlers'

/** Checks the Resend key: full access or sending only. Admin only. */
export default defineEventHandler((event) => mailCheckKey(event))

import { mailGetDomain } from '../../../../../mail/handlers'

/** Reads one Resend domain with its status. Admin only. */
export default defineEventHandler((event) => mailGetDomain(event))

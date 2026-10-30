import { mailVerifyDomain } from '../../../../../../mail/handlers'

/** Asks Resend to verify the DNS records now. Admin only. */
export default defineEventHandler((event) => mailVerifyDomain(event))

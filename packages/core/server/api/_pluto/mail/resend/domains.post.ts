import { mailCreateDomain } from '../../../../mail/handlers'

/** Creates a domain in Resend and returns its DNS records. Admin only. */
export default defineEventHandler((event) => mailCreateDomain(event))

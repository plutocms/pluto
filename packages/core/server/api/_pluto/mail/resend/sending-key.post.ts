import { mailCreateSendingKey } from '../../../../mail/handlers'

/** Makes a sending-only Resend key. Admin only. The response shows it once. */
export default defineEventHandler((event) => mailCreateSendingKey(event))

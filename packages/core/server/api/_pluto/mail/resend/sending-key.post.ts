import { mailCreateSendingKey } from '../../../../mail/handlers'

export default defineEventHandler((event) => mailCreateSendingKey(event))

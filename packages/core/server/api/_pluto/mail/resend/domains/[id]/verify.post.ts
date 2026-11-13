import { mailVerifyDomain } from '../../../../../../mail/handlers'

export default defineEventHandler((event) => mailVerifyDomain(event))

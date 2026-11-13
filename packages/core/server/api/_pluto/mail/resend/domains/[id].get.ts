import { mailGetDomain } from '../../../../../mail/handlers'

export default defineEventHandler((event) => mailGetDomain(event))

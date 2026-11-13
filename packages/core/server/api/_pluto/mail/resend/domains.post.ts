import { mailCreateDomain } from '../../../../mail/handlers'

export default defineEventHandler((event) => mailCreateDomain(event))

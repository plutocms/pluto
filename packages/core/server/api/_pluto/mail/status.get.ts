import { mailStatus } from '../../../mail/handlers'

export default defineEventHandler((event) => mailStatus(event))

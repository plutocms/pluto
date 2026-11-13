import { defineEventHandler } from 'h3'
import { handleSession } from '../../utils/auth-flow'

export default defineEventHandler(handleSession)

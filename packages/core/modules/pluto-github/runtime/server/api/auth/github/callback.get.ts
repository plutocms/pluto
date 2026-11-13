import { defineEventHandler } from 'h3'
import { handleCallback } from '../../../utils/auth-flow'

export default defineEventHandler(handleCallback)

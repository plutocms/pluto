import { defineEventHandler } from 'h3'
import { handleLogin } from '../../../utils/auth-flow'

export default defineEventHandler(handleLogin)

import { defineEventHandler } from 'h3'
import { handleLogout } from '../../utils/auth-flow'

export default defineEventHandler(handleLogout)

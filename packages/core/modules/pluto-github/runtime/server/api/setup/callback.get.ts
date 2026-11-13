import { defineEventHandler } from 'h3'
import { handleSetupCallback } from '../../utils/github-setup-flow'

export default defineEventHandler(handleSetupCallback)

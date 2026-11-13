import { defineEventHandler } from 'h3'
import { handleSetupStart } from '../../utils/github-setup-flow'

export default defineEventHandler(handleSetupStart)

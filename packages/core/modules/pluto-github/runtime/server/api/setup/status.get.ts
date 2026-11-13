import { defineEventHandler } from 'h3'
import { handleSetupStatus } from '../../utils/github-setup-flow'

export default defineEventHandler(handleSetupStatus)

import { defineEventHandler } from 'h3'
import { handleDeployStatus } from '../../utils/deploy'

export default defineEventHandler(handleDeployStatus)

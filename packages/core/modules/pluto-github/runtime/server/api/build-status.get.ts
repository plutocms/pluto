import { defineEventHandler } from 'h3'
import { handleBuildStatus } from '../utils/build-status'

export default defineEventHandler(handleBuildStatus)

import { defineEventHandler } from 'h3'
import { handleDomainCheck } from '../../utils/deploy'

export default defineEventHandler(handleDomainCheck)

import { defineEventHandler } from 'h3'
import { buildPublicIndex } from '../../../server/utils/pluto-public-api'

export default defineEventHandler((event) => buildPublicIndex(event))

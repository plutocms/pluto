import { defineEventHandler } from 'h3'
import { assertPlutoSameOrigin } from '../utils/pluto-origin'

export default defineEventHandler((event) => {
  assertPlutoSameOrigin(event)
})

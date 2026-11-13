import { defineEventHandler } from 'h3'
import { handlePlutoApiCors } from '../utils/pluto-api-cors'

export default defineEventHandler((event) => {
  if (handlePlutoApiCors(event)) {
    return ''
  }
})

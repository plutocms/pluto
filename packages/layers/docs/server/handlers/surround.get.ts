import { defineEventHandler } from 'h3'

// Added by the module only when `plutoDocs.render` is `'hybrid'` or `'runtime'`. A route of the
// public API (`/api/pluto/v1/docs/:type/surround`): the answer is `{ data }`, like core's routes.
export default defineEventHandler(async (event) => ({
  data: await plutoRuntimeSurround(event),
}))

import path from 'node:path'
import { $ } from 'bun'

const projectId = process.env.SUPABASE_PROJECT_ID

console.log(`Generating Supabase types for project: ${projectId}`)

const _path = path.resolve(__dirname, '../shared/types/supabase.ts')

console.log(`Output path: ${_path}`)

await $`npx -y supabase gen types typescript --project-id "${projectId}" --schema public > ${_path}`

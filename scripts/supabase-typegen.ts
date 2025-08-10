import { $ } from 'bun'

const projectId = process.env.SUPABASE_PROJECT_ID

await $`npx -y supabase gen types typescript --project-id "${projectId}" --schema public > shared/types/supabase.ts`

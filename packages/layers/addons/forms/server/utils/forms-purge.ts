import type { PlutoFormStore } from '../../shared/types/forms'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Deletes the submissions older than the retention of each form. A form with 0 days keeps its
 * submissions. A store error for one form is logged, and the others still run.
 */
export async function purgeFormSubmissions(
  store: PlutoFormStore,
  forms: Array<{ handle: string; retentionDays: number }>,
  now: Date = new Date()
): Promise<{ purged: number; failed: string[] }> {
  const result = { purged: 0, failed: [] as string[] }
  for (const form of forms) {
    if (form.retentionDays <= 0) {
      continue
    }
    try {
      result.purged += await store.purge(
        form.handle,
        new Date(now.getTime() - form.retentionDays * DAY_MS)
      )
    } catch (error) {
      result.failed.push(form.handle)
      console.warn(
        `[pluto-forms] The purge of "${form.handle}" failed: ${(error as Error).message}`
      )
    }
  }
  return result
}

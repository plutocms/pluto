/**
 * Sections that layers add to the Email settings page (`mailPanels`), in
 * registry order. The title and the description are key-or-literal.
 */
export function usePlutoMailPanels() {
  const registry = usePlutoRegistry()
  const { tx } = usePlutoI18n()

  const items = computed<PlutoMailPanel[]>(() =>
    registry.mailPanels.list.value.map((panel) => ({
      ...panel,
      title: tx(panel.title),
      description: panel.description === undefined ? undefined : tx(panel.description),
    }))
  )

  return { items }
}

/** The answer of `POST /api/_pluto/mail/test`. */
export interface PlutoMailTestResult {
  ok: boolean
  id: string | null
  driver: string
}

/** What the key check knows. `unknown` means the check did not run yet. */
export type PlutoMailKeyState = 'unknown' | 'checking' | 'full' | 'sending' | 'invalid' | 'missing' | 'failed'

// The domain the admin worked on last, per browser. A convenience only: it
// saves picking the domain again after a reload. Storage can be blocked, so
// every access is guarded.
const DOMAIN_STORAGE_KEY = 'pluto-mail-domain'

function rememberDomain(id: string): void {
  try {
    localStorage.setItem(DOMAIN_STORAGE_KEY, id)
  } catch {
    // Private mode or blocked storage: the page works without it.
  }
}

function recalledDomainId(): string | null {
  try {
    return localStorage.getItem(DOMAIN_STORAGE_KEY)
  } catch {
    return null
  }
}

/** Maps a failed key check to a state the page can show. */
function keyStateFromError(error: unknown): PlutoMailKeyState {
  const code = plutoMailErrorCode(error)
  if (code === 'not_configured') {
    return 'missing'
  }
  if (code === 'invalid_key') {
    return 'invalid'
  }
  return 'failed'
}

/**
 * The client of the admin mail routes (`/api/_pluto/mail/**`) and the shared
 * state of the Email settings page. The state lives in `useState`, so the
 * setup steps stay in step with each other. The browser never holds the
 * Resend key: the server reads it from its environment.
 *
 * Every method that calls the server rejects with the server error. Show it
 * with `usePlutoErrorText()`.
 */
export function usePlutoMail() {
  const status = useState<PlutoMailStatus | null>('pluto-mail-status', () => null)
  const statusPending = useState<boolean>('pluto-mail-status-pending', () => false)
  const keyState = useState<PlutoMailKeyState>('pluto-mail-key-state', () => 'unknown')
  const domains = useState<PlutoMailDomain[]>('pluto-mail-domains', () => [])
  const domain = useState<PlutoMailDomain | null>('pluto-mail-domain', () => null)

  async function loadStatus(): Promise<PlutoMailStatus> {
    statusPending.value = true
    try {
      const next = await $fetch<PlutoMailStatus>('/api/_pluto/mail/status')
      status.value = next
      return next
    } finally {
      statusPending.value = false
    }
  }

  /** Makes a domain the one the page works on, and keeps it in the `domains` list. */
  function selectDomain(next: PlutoMailDomain | null) {
    domain.value = next
    if (next) {
      domains.value = domains.value.some((entry) => entry.id === next.id)
        ? domains.value.map((entry) => (entry.id === next.id ? next : entry))
        : [...domains.value, next]
      rememberDomain(next.id)
    }
  }

  /** Checks the key with Resend. Sets `keyState` and `domains`. */
  async function checkKey(): Promise<PlutoMailKeyState> {
    keyState.value = 'checking'
    try {
      const result = await $fetch<PlutoMailKeyCheck>('/api/_pluto/mail/resend/check-key', { method: 'POST' })
      domains.value = result.domains
      keyState.value = result.access
      // Pick the domain of the last visit, if it still exists.
      const recalled = recalledDomainId()
      if (!domain.value && recalled) {
        selectDomain(result.domains.find((entry) => entry.id === recalled) ?? null)
      }
    } catch (error) {
      domains.value = []
      keyState.value = keyStateFromError(error)
    }
    return keyState.value
  }

  // The explicit result type keeps TypeScript from walking the typed route
  // tree of every layer ("excessive stack depth" in a big app).
  async function sendTest(to: string, locale?: string): Promise<PlutoMailTestResult> {
    return $fetch<PlutoMailTestResult>('/api/_pluto/mail/test', { method: 'POST', body: { to, locale } })
  }

  async function createDomain(name: string, region: string): Promise<PlutoMailDomain> {
    const created = await $fetch<PlutoMailDomain>('/api/_pluto/mail/resend/domains', { method: 'POST', body: { name, region } })
    selectDomain(created)
    return created
  }

  async function refreshDomain(id: string): Promise<PlutoMailDomain> {
    const fresh = await $fetch<PlutoMailDomain>(`/api/_pluto/mail/resend/domains/${encodeURIComponent(id)}`)
    selectDomain(fresh)
    return fresh
  }

  async function verifyDomain(id: string): Promise<void> {
    await $fetch(`/api/_pluto/mail/resend/domains/${encodeURIComponent(id)}/verify`, { method: 'POST' })
  }

  /** Makes a sending-only key. The answer holds the key once. */
  async function createSendingKey(domainId?: string): Promise<string> {
    const result = await $fetch<{
 token: string
}>('/api/_pluto/mail/resend/sending-key', {
      method: 'POST',
      body: { domainId },
    })
    return result.token
  }

  return {
    status,
    statusPending,
    keyState,
    domains,
    domain,
    loadStatus,
    checkKey,
    sendTest,
    createDomain,
    refreshDomain,
    verifyDomain,
    createSendingKey,
    selectDomain,
  }
}

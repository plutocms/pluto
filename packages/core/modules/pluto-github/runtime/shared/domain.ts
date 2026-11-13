export type PlutoDeployHostId = '' | 'vercel' | 'netlify'

export interface PlutoDeployHost {
  id: PlutoDeployHostId
  site: string
}

export const GITHUB_PAGES_A = [
  '185.199.108.153',
  '185.199.109.153',
  '185.199.110.153',
  '185.199.111.153',
]

export const GITHUB_PAGES_AAAA = [
  '2606:50c0:8000::153',
  '2606:50c0:8001::153',
  '2606:50c0:8002::153',
  '2606:50c0:8003::153',
]

const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

export function normalizeDomain(input: string): string | null {
  const value = input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '')
    .replace(/\.$/, '')
  if (!value) {
    return ''
  }
  const labels = value.split('.')
  if (
    value.length > 253 ||
    labels.length < 2 ||
    !labels.every((label) => LABEL.test(label)) ||
    // The top-level label is never only digits: this refuses an IP address.
    /^\d+$/.test(labels.at(-1)!)
  ) {
    return null
  }
  return value
}

export function isApexDomain(domain: string): boolean {
  return domain.split('.').length === 2
}

export function detectDeployHost(
  env: Record<string, string | undefined>
): PlutoDeployHost {
  if (env.VERCEL) {
    return { id: 'vercel', site: env.VERCEL_PROJECT_PRODUCTION_URL ?? '' }
  }
  if (env.NETLIFY === 'true') {
    return { id: 'netlify', site: env.SITE_NAME ?? '' }
  }
  return { id: '', site: '' }
}

export function hostDomainSettingsUrl(
  id: 'vercel' | 'netlify' | 'cloudflare',
  site = ''
): string {
  switch (id) {
    case 'vercel':
      return 'https://vercel.com/d?to=%2F%5Bteam%5D%2F%5Bproject%5D%2Fsettings%2Fdomains&title=Domains'
    case 'netlify':
      return site
        ? `https://app.netlify.com/projects/${encodeURIComponent(site)}/domain-management`
        : 'https://app.netlify.com/'
    default:
      return 'https://dash.cloudflare.com/?to=/:account/workers-and-pages'
  }
}

import type { PlutoDeployHost } from './domain'
import type { PackageManager } from './pages-workflow'

export interface PlutoPagesDeploy {
  state: 'none' | 'success' | 'failure' | 'pending' | 'unknown'
  url?: string
  logUrl?: string
  at?: string
}

export interface PlutoDeployStatus {
  repo: string
  branch: string
  local: boolean
  packageManager: PackageManager
  workflow: {
    path: string
    exists?: boolean
    current?: boolean
    text: string
  }
  deploy: PlutoPagesDeploy
  pagesUrl: string
  host: PlutoDeployHost
  siteHost?: string
}

export interface PlutoPagesSetupResult {
  status: PlutoDeployStatus
  committed: boolean
}

export interface PlutoDomainCheck {
  domain: string
  state: 'ok' | 'missing' | 'other'
  found: string[]
}

import type { PlutoDeployHost } from './domain'
import type { PackageManager } from './pages-workflow'

/**
 * The last deploy to GitHub Pages: the newest deployment of the `github-pages` environment and its
 * newest status. Pluto reads it with the GitHub API, with no CLI and, for a public repo, no token.
 */
export interface PlutoPagesDeploy {
  /**
   * `none`: no deploy yet. `success`, `failure`, `pending`: the state of the newest deploy.
   * `unknown`: GitHub did not answer, for example a private repo and no token.
   */
  state: 'none' | 'success' | 'failure' | 'pending' | 'unknown'
  /** The address of the site, a custom domain included. */
  url?: string
  /** The page of the run on GitHub, with the log. */
  logUrl?: string
  /** ISO time of the newest status. */
  at?: string
}

/** The answer of `GET /api/_pluto/github/deploy/status`. */
export interface PlutoDeployStatus {
  repo: string
  branch: string
  /** True for local mode on this computer: the page can write and commit the workflow. */
  local: boolean
  packageManager: PackageManager
  workflow: {
    path: string
    /** Local mode only: the file is in the project. */
    exists?: boolean
    /** Local mode only: the file is the one that Pluto writes now. */
    current?: boolean
    /** The workflow to copy, for a setup by hand. */
    text: string
  }
  /** The last deploy to GitHub Pages. */
  deploy: PlutoPagesDeploy
  /** The default address of the Pages site. */
  pagesUrl: string
  /** The host that built the app. Empty in local mode. */
  host: PlutoDeployHost
  /** Not in local mode: the domain of this request, so the address of the live admin. */
  siteHost?: string
}

/** The answer of `POST /api/_pluto/github/deploy/pages`. */
export interface PlutoPagesSetupResult {
  status: PlutoDeployStatus
  /** The workflow was written and committed. */
  committed: boolean
}

/** The answer of `GET /api/_pluto/github/deploy/dns?domain=<domain>`. */
export interface PlutoDomainCheck {
  domain: string
  /**
   * `ok`: every address of the domain is a GitHub Pages address. `missing`: no address yet.
   * `other`: the domain points somewhere else (`found` lists the addresses).
   */
  state: 'ok' | 'missing' | 'other'
  /** The CNAME targets and the addresses that the DNS gave. */
  found: string[]
}

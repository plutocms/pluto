import type { PackageManager } from './pages-workflow'

/** The state of GitHub Pages for the repo, read with the GitHub CLI of this computer. */
export interface PlutoPagesState {
  /** `on`: Pages is on. `off`: GitHub answered 404. `unknown`: the CLI could not tell. */
  state: 'on' | 'off' | 'unknown'
  url?: string
  /** `workflow`: the site comes from an Action. `legacy`: from a branch. */
  source?: 'workflow' | 'legacy'
  /** Why the state is unknown: no `gh`, `gh` not signed in, or another failure. */
  reason?: 'no-gh' | 'signed-out' | 'error'
}

/** The answer of `GET /api/_pluto/github/deploy/status`. */
export interface PlutoDeployStatus {
  repo: string
  branch: string
  /** True for local mode on this computer: the page can write the workflow and run `gh`. */
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
  /** Local mode only. */
  pages?: PlutoPagesState
  /** The default address of the Pages site. */
  pagesUrl: string
}

/** The answer of `POST /api/_pluto/github/deploy/pages`. */
export interface PlutoPagesSetupResult {
  status: PlutoDeployStatus
  /** The workflow was written and committed. */
  committed: boolean
  /** Pages was turned on (or was on already) with the Actions source. */
  pagesOn: boolean
}

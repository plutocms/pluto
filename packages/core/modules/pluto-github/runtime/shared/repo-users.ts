/** The GitHub role of a user who can sign in: admin, maintain, or write (push). */
export type PlutoGithubRepoRole = 'admin' | 'maintain' | 'write'

/** One person with write access to the content repo. */
export interface PlutoGithubRepoUser {
  id: number
  login: string
  avatarUrl: string
  /** The GitHub profile. */
  url: string
  role: PlutoGithubRepoRole
  /** False when `ALLOWED_USERS` is set and does not have this login. */
  canSignIn: boolean
}

/**
 * The answer of `GET /api/_pluto/github/users`. `users` is empty with a `reason` when the list
 * cannot load: `no-repo` (no repo is known), `no-app` (local mode with no GitHub App and no read
 * token, so there is no token to ask GitHub) or `app-error` (local mode: the App gave no token; it
 * is not installed on the repo, or its key is wrong).
 */
export interface PlutoGithubUsersResponse {
  repo: string
  users: PlutoGithubRepoUser[]
  /** True when `ALLOWED_USERS` limits the sign-in. */
  restricted: boolean
  reason?: 'no-repo' | 'no-app' | 'app-error'
}

/** The parts of a GitHub collaborator that Pluto reads. */
export interface GithubCollaborator {
  id: number
  login: string
  avatar_url?: string
  html_url?: string
  role_name?: string
  permissions?: {
    admin?: boolean
    maintain?: boolean
    push?: boolean
  }
}

/** The role of a collaborator, or `null` when it cannot push (triage, read). */
export function repoRoleOf(
  collaborator: GithubCollaborator
): PlutoGithubRepoRole | null {
  const permissions = collaborator.permissions ?? {}
  if (permissions.admin || collaborator.role_name === 'admin') {
    return 'admin'
  }
  if (permissions.maintain || collaborator.role_name === 'maintain') {
    return 'maintain'
  }
  if (permissions.push || collaborator.role_name === 'write') {
    return 'write'
  }
  return null
}

const ROLE_ORDER: Record<PlutoGithubRepoRole, number> = {
  admin: 0,
  maintain: 1,
  write: 2,
}

/**
 * Turns the collaborators into the users of the page: only the ones who can push, admins first,
 * then by login. `allowedUsers` holds lowercase logins; empty means every user can sign in.
 */
export function toRepoUsers(
  collaborators: GithubCollaborator[],
  allowedUsers: readonly string[]
): PlutoGithubRepoUser[] {
  const users: PlutoGithubRepoUser[] = []
  for (const collaborator of collaborators) {
    const role = repoRoleOf(collaborator)
    if (!role) {
      continue
    }
    users.push({
      id: collaborator.id,
      login: collaborator.login,
      avatarUrl: collaborator.avatar_url ?? '',
      url: collaborator.html_url ?? `https://github.com/${collaborator.login}`,
      role,
      canSignIn:
        allowedUsers.length === 0 ||
        allowedUsers.includes(collaborator.login.toLowerCase()),
    })
  }
  return users.sort(
    (a, b) =>
      ROLE_ORDER[a.role] - ROLE_ORDER[b.role] ||
      a.login.localeCompare(b.login, 'en', { sensitivity: 'base' })
  )
}

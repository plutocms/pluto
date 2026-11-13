export type PlutoGithubRepoRole = 'admin' | 'maintain' | 'write'

export interface PlutoGithubRepoUser {
  id: number
  login: string
  avatarUrl: string
  url: string
  role: PlutoGithubRepoRole
  canSignIn: boolean
}

export interface PlutoGithubUsersResponse {
  repo: string
  users: PlutoGithubRepoUser[]
  restricted: boolean
  reason?: 'no-repo' | 'no-app' | 'app-error'
}

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

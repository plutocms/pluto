import type { H3Event } from 'h3'
import type { LocalGitStatus } from '../store/local-git'
import { createError, setResponseHeader } from 'h3'
import { createPlutoError } from '../../../../../server/utils/pluto-error'
import {
  LocalPushFailure,
  pushLocalGit,
  readLocalGitStatus,
} from '../store/local-git'
import { getGithubConfig } from './github-config'
import { isLocalRequest } from './session'

function localRoot(event: H3Event): string {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  const config = getGithubConfig()
  if (
    !config.dev ||
    config.storage !== 'fs' ||
    !config.fsRoot ||
    !isLocalRequest(event)
  ) {
    throw createError({ statusCode: 404 })
  }
  return config.fsRoot
}

export async function handleLocalGitStatus(
  event: H3Event
): Promise<LocalGitStatus> {
  return readLocalGitStatus(localRoot(event))
}

const PUSH_ERRORS: Record<
  LocalPushFailure['reason'],
  { statusCode: number; message: string; key: string }
> = {
  'not-a-repo': {
    statusCode: 409,
    message: 'The project is not a Git repo.',
    key: 'notARepo',
  },
  detached: {
    statusCode: 409,
    message: 'Git is not on a branch.',
    key: 'detached',
  },
  'no-remote': {
    statusCode: 409,
    message: 'The repo has no remote.',
    key: 'noRemote',
  },
  rejected: {
    statusCode: 409,
    message: 'The remote has commits that this repo does not have. Pull first.',
    key: 'rejected',
  },
  auth: {
    statusCode: 502,
    message: 'Git could not sign in to the remote.',
    key: 'auth',
  },
  timeout: {
    statusCode: 504,
    message: 'The push took too long.',
    key: 'timeout',
  },
  failed: { statusCode: 502, message: 'Git could not push.', key: 'failed' },
}

export async function handleLocalGitPush(
  event: H3Event
): Promise<LocalGitStatus> {
  const root = localRoot(event)
  try {
    return await pushLocalGit(root)
  } catch (error) {
    if (!(error instanceof LocalPushFailure)) {
      throw error
    }
    const known = PUSH_ERRORS[error.reason]
    throw createPlutoError({
      statusCode: known.statusCode,
      message: known.message,
      key: `pluto.github.local.errors.${known.key}`,
      data: { reason: error.reason },
    })
  }
}

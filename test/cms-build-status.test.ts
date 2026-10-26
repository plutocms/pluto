import { describe, expect, it } from 'vitest'
import {
  buildStatusItems,
  checkRunState,
  commitHeadline,
  commitStatusState,
  deploymentState,
  reduceBuildState,
  reduceBuildStatus,
  safeHttpUrl,
  shouldPoll,
} from '../modules/pluto-cms/runtime/shared/build-status'
import { showBuildStatus } from '../modules/pluto-cms/runtime/shared/client-rules'

describe('checkRunState', () => {
  it('is pending until the run is completed', () => {
    for (const status of ['queued', 'in_progress', 'waiting', 'requested', 'pending']) {
      expect(checkRunState({ status })).toBe('pending')
    }
  })

  it('is a success for success, neutral and skipped', () => {
    for (const conclusion of ['success', 'neutral', 'skipped']) {
      expect(checkRunState({ status: 'completed', conclusion })).toBe('success')
    }
  })

  it('fails for every other conclusion', () => {
    for (const conclusion of ['failure', 'cancelled', 'timed_out', 'action_required', 'startup_failure', 'stale', null]) {
      expect(checkRunState({ status: 'completed', conclusion })).toBe('failure')
    }
  })
})

describe('commitStatusState and deploymentState', () => {
  it('maps the commit status states', () => {
    expect(commitStatusState('success')).toBe('success')
    expect(commitStatusState('pending')).toBe('pending')
    expect(commitStatusState('failure')).toBe('failure')
    expect(commitStatusState('error')).toBe('failure')
    expect(commitStatusState(undefined)).toBe('pending')
  })

  it('maps the deployment states', () => {
    expect(deploymentState('success')).toBe('success')
    expect(deploymentState('inactive')).toBe('success')
    for (const state of ['queued', 'pending', 'in_progress', undefined]) {
      expect(deploymentState(state)).toBe('pending')
    }
    expect(deploymentState('failure')).toBe('failure')
    expect(deploymentState('error')).toBe('failure')
  })
})

describe('reduceBuildState', () => {
  it('is none without items', () => {
    expect(reduceBuildState([])).toBe('none')
  })

  it('is pending while any item is pending, even when another failed', () => {
    expect(reduceBuildState([{ state: 'success' }, { state: 'pending' }])).toBe('pending')
    expect(reduceBuildState([{ state: 'failure' }, { state: 'pending' }])).toBe('pending')
  })

  it('is failure when all are done and one failed', () => {
    expect(reduceBuildState([{ state: 'success' }, { state: 'failure' }])).toBe('failure')
  })

  it('is success when all are done and none failed', () => {
    expect(reduceBuildState([{ state: 'success' }, { state: 'success' }])).toBe('success')
  })
})

describe('reduceBuildStatus', () => {
  it('gives none when the commit has no item', () => {
    expect(reduceBuildStatus({})).toEqual({ state: 'none', items: [] })
    expect(reduceBuildStatus({ checkRuns: [], statuses: [], deployments: [] })).toEqual({ state: 'none', items: [] })
  })

  it('reads a check run (a GitHub Action)', () => {
    const { state, items } = reduceBuildStatus({
      checkRuns: [{
        name: 'build',
        status: 'in_progress',
        conclusion: null,
        html_url: 'https://github.com/acme/site/actions/runs/1',
        started_at: '2026-10-26T10:00:00Z',
      }],
    })
    expect(state).toBe('pending')
    expect(items).toEqual([{
      kind: 'check',
      name: 'build',
      state: 'pending',
      url: 'https://github.com/acme/site/actions/runs/1',
      startedAt: '2026-10-26T10:00:00Z',
      completedAt: undefined,
      description: undefined,
    }])
  })

  it('falls back to details_url when a check run has no html_url', () => {
    const [item] = buildStatusItems({ checkRuns: [{ name: 'a', status: 'completed', conclusion: 'success', details_url: 'https://ci.example.com/run/3' }] })
    expect(item!.url).toBe('https://ci.example.com/run/3')
  })

  it('reads a commit status (Vercel)', () => {
    const { state, items } = reduceBuildStatus({
      statuses: [{ context: 'Vercel', state: 'success', target_url: 'https://vercel.com/acme/site/abc', description: 'Deployment has completed', updated_at: '2026-10-26T10:03:00Z' }],
    })
    expect(state).toBe('success')
    expect(items[0]).toMatchObject({ kind: 'status', name: 'Vercel', state: 'success', url: 'https://vercel.com/acme/site/abc', description: 'Deployment has completed', completedAt: '2026-10-26T10:03:00Z' })
  })

  it('reads a deployment with its latest status', () => {
    const { state, items } = reduceBuildStatus({
      deployments: [{
        id: 9,
        environment: 'Production',
        created_at: '2026-10-26T10:00:00Z',
        status: { state: 'success', log_url: 'https://vercel.com/log', environment_url: 'https://site.example.com', created_at: '2026-10-26T10:02:00Z' },
      }],
    })
    expect(state).toBe('success')
    expect(items[0]).toMatchObject({ kind: 'deployment', name: 'Production', state: 'success', url: 'https://vercel.com/log', completedAt: '2026-10-26T10:02:00Z' })
  })

  it('counts a deployment with no status as pending', () => {
    const { state } = reduceBuildStatus({ deployments: [{ id: 1, environment: 'Production', status: null }] })
    expect(state).toBe('pending')
  })

  it('keeps the newest deployment of each environment', () => {
    const { items } = reduceBuildStatus({
      deployments: [
        { id: 1, environment: 'Production', created_at: '2026-10-26T09:00:00Z', status: { state: 'failure' } },
        { id: 2, environment: 'Production', created_at: '2026-10-26T10:00:00Z', status: { state: 'success' } },
        { id: 3, environment: 'Preview', created_at: '2026-10-26T08:00:00Z', status: { state: 'success' } },
      ],
    })
    expect(items.map((item) => [item.name, item.state])).toEqual([['Production', 'success'], ['Preview', 'success']])
  })

  it('handles a mix: an Action done, Vercel pending', () => {
    const { state, items } = reduceBuildStatus({
      checkRuns: [{ name: 'lint', status: 'completed', conclusion: 'success' }],
      statuses: [{ context: 'Vercel', state: 'pending' }],
    })
    expect(state).toBe('pending')
    expect(items.map((item) => item.state)).toEqual(['success', 'pending'])
  })

  it('handles a mix: all done, one failed', () => {
    const { state } = reduceBuildStatus({
      checkRuns: [{ name: 'lint', status: 'completed', conclusion: 'success' }, { name: 'build', status: 'completed', conclusion: 'failure' }],
      statuses: [{ context: 'Vercel', state: 'success' }],
      deployments: [{ id: 1, environment: 'Production', status: { state: 'success' } }],
    })
    expect(state).toBe('failure')
  })

  it('handles a mix: all done and good', () => {
    const { state } = reduceBuildStatus({
      checkRuns: [{ name: 'lint', status: 'completed', conclusion: 'skipped' }],
      statuses: [{ context: 'Vercel', state: 'success' }],
      deployments: [{ id: 1, environment: 'Production', status: { state: 'inactive' } }],
    })
    expect(state).toBe('success')
  })

  it('gives names to unnamed items', () => {
    const items = buildStatusItems({ checkRuns: [{ status: 'queued' }], statuses: [{ state: 'pending' }], deployments: [{ status: null }] })
    expect(items.map((item) => item.name)).toEqual(['Check', 'Status', 'Deployment'])
  })

  it('drops a bad date and a URL that is not http or https', () => {
    const [item] = buildStatusItems({ statuses: [{ context: 'x', state: 'success', target_url: 'javascript:alert(1)', created_at: 'not a date' }] })
    expect(item!.url).toBeUndefined()
    expect(item!.startedAt).toBeUndefined()
  })
})

describe('safeHttpUrl', () => {
  it('keeps http and https only', () => {
    expect(safeHttpUrl('https://github.com/a/b')).toBe('https://github.com/a/b')
    expect(safeHttpUrl('http://localhost:3000/x')).toBe('http://localhost:3000/x')
    expect(safeHttpUrl('javascript:alert(1)')).toBeUndefined()
    expect(safeHttpUrl('data:text/html,hi')).toBeUndefined()
    expect(safeHttpUrl('/relative')).toBeUndefined()
    expect(safeHttpUrl(null)).toBeUndefined()
    expect(safeHttpUrl('')).toBeUndefined()
  })
})

describe('commitHeadline', () => {
  it('keeps the first line, cut to 200 characters', () => {
    expect(commitHeadline('content(post): update "a"\n\nbody')).toBe('content(post): update "a"')
    expect(commitHeadline('x'.repeat(300))).toHaveLength(200)
    expect(commitHeadline(undefined)).toBe('')
  })
})

describe('shouldPoll', () => {
  const base = { startedAt: 1_000, now: 1_000, hidden: false }

  it('polls while pending, and before the first answer', () => {
    expect(shouldPoll({ ...base, state: 'pending' })).toBe(true)
    expect(shouldPoll({ ...base, state: undefined })).toBe(true)
  })

  it('stops when the state is final', () => {
    expect(shouldPoll({ ...base, state: 'success' })).toBe(false)
    expect(shouldPoll({ ...base, state: 'failure' })).toBe(false)
    expect(shouldPoll({ ...base, state: 'none' })).toBe(false)
  })

  it('stops when the page is hidden', () => {
    expect(shouldPoll({ ...base, state: 'pending', hidden: true })).toBe(false)
  })

  it('stops after 15 minutes', () => {
    expect(shouldPoll({ ...base, state: 'pending', now: 1_000 + 15 * 60_000 - 1 })).toBe(true)
    expect(shouldPoll({ ...base, state: 'pending', now: 1_000 + 15 * 60_000 })).toBe(false)
  })

  it('waits for the checks after a save: none is not final for a minute', () => {
    expect(shouldPoll({ ...base, state: 'none', afterSave: true })).toBe(true)
    expect(shouldPoll({ ...base, state: 'none', afterSave: true, now: 1_000 + 59_000 })).toBe(true)
    expect(shouldPoll({ ...base, state: 'none', afterSave: true, now: 1_000 + 60_000 })).toBe(false)
    expect(shouldPoll({ ...base, state: 'none', afterSave: false, now: 1_000 + 5_000 })).toBe(false)
  })
})

describe('showBuildStatus', () => {
  it('shows for GitHub storage when a save starts a deploy', () => {
    expect(showBuildStatus({ storage: 'github', skipDeploy: false })).toBe(true)
  })

  it('hides for fs storage, for skipDeploy, and for a missing config', () => {
    expect(showBuildStatus({ storage: 'fs', skipDeploy: false })).toBe(false)
    expect(showBuildStatus({ storage: 'github', skipDeploy: true })).toBe(false)
    expect(showBuildStatus({ storage: 'github' })).toBe(false)
    expect(showBuildStatus(undefined)).toBe(false)
  })
})

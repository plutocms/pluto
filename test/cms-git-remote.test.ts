import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { parseGitConfigOrigin, parseGithubRepoUrl, readGitOrigin } from '../modules/pluto-cms/git-remote'

describe('parseGithubRepoUrl', () => {
  it.each([
    ['https://github.com/acme/site.git', 'acme/site'],
    ['https://github.com/acme/site', 'acme/site'],
    ['https://github.com/acme/site/', 'acme/site'],
    ['https://user:token@github.com/acme/site.git', 'acme/site'],
    ['git@github.com:acme/site.git', 'acme/site'],
    ['git@github.com:acme/site', 'acme/site'],
    ['ssh://git@github.com/acme/site.git', 'acme/site'],
    ['ssh://git@github.com:22/acme/site.git', 'acme/site'],
    ['git://github.com/acme/my.site-1.git', 'acme/my.site-1'],
  ])('reads %s', (url, repo) => {
    expect(parseGithubRepoUrl(url)).toBe(repo)
  })

  it.each([
    'https://gitlab.com/acme/site.git',
    'git@bitbucket.org:acme/site.git',
    'https://github.com/acme',
    'https://github.com/acme/site/extra',
    '../local/path',
    '',
  ])('returns undefined for %s', (url) => {
    expect(parseGithubRepoUrl(url)).toBeUndefined()
  })
})

describe('parseGitConfigOrigin', () => {
  it('reads the url of the origin remote', () => {
    const text = [
      '[core]',
      '\trepositoryformatversion = 0',
      '[remote "upstream"]',
      '\turl = https://github.com/other/fork.git',
      '[remote "origin"]',
      '\turl = git@github.com:acme/site.git',
      '\tfetch = +refs/heads/*:refs/remotes/origin/*',
      '[branch "main"]',
      '\tremote = origin',
    ].join('\r\n')

    expect(parseGitConfigOrigin(text)).toBe('git@github.com:acme/site.git')
  })

  it('returns undefined when there is no origin', () => {
    expect(parseGitConfigOrigin('[remote "upstream"]\n\turl = x\n')).toBeUndefined()
  })
})

describe('readGitOrigin', () => {
  let dir = ''

  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('reads .git/config from a parent folder, with no shell call', () => {
    dir = mkdtempSync(join(tmpdir(), 'pluto-git-'))
    mkdirSync(join(dir, '.git'))
    mkdirSync(join(dir, 'apps', 'site'), { recursive: true })
    writeFileSync(join(dir, '.git', 'config'), '[remote "origin"]\n\turl = https://github.com/acme/site.git\n')

    expect(readGitOrigin(join(dir, 'apps', 'site'))).toBe('https://github.com/acme/site.git')
  })

  it('follows the gitdir pointer of a worktree', () => {
    dir = mkdtempSync(join(tmpdir(), 'pluto-git-'))
    mkdirSync(join(dir, 'main', '.git', 'worktrees', 'wt'), { recursive: true })
    writeFileSync(join(dir, 'main', '.git', 'config'), '[remote "origin"]\n\turl = git@github.com:acme/site.git\n')
    writeFileSync(join(dir, 'main', '.git', 'worktrees', 'wt', 'commondir'), '../..\n')
    mkdirSync(join(dir, 'wt'))
    writeFileSync(join(dir, 'wt', '.git'), `gitdir: ${join(dir, 'main', '.git', 'worktrees', 'wt')}\n`)

    expect(readGitOrigin(join(dir, 'wt'))).toBe('git@github.com:acme/site.git')
  })

  it('returns undefined for a folder with no git repo', () => {
    dir = mkdtempSync(join(tmpdir(), 'pluto-git-'))
    mkdirSync(join(dir, '.git'))

    expect(readGitOrigin(dir)).toBeUndefined()
  })
})

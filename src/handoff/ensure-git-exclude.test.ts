import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ensureGitExcludesHandoff } from './ensure-git-exclude.ts'

let workDir: string
let repoDir: string

function git(cwd: string, ...args: string[]) {
  execFileSync('git', args, { cwd, stdio: 'ignore' })
}

beforeEach(() => {
  workDir = realpathSync(mkdtempSync(join(tmpdir(), 'review-workspace-git-exclude-')))
  repoDir = join(workDir, 'repo')
  mkdirSync(repoDir)
  git(repoDir, 'init', '-q')
})

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true })
})

describe('ensureGitExcludesHandoff', () => {
  it('adds the entry to .git/info/exclude and leaves .gitignore alone', () => {
    expect(ensureGitExcludesHandoff(repoDir)).toBe(true)

    expect(readFileSync(join(repoDir, '.git', 'info', 'exclude'), 'utf-8')).toContain('.review-feedback/\n')
    expect(existsSync(join(repoDir, '.gitignore'))).toBe(false)
  })

  it('does not touch an existing .gitignore', () => {
    writeFileSync(join(repoDir, '.gitignore'), 'node_modules/\n')

    ensureGitExcludesHandoff(repoDir)

    expect(readFileSync(join(repoDir, '.gitignore'), 'utf-8')).toBe('node_modules/\n')
  })

  it('does not add the entry twice', () => {
    ensureGitExcludesHandoff(repoDir)
    ensureGitExcludesHandoff(repoDir)

    const lines = readFileSync(join(repoDir, '.git', 'info', 'exclude'), 'utf-8').split('\n')
    expect(lines.filter((l) => l === '.review-feedback/')).toHaveLength(1)
  })

  it('keeps existing exclude lines and adds a missing final newline', () => {
    mkdirSync(join(repoDir, '.git', 'info'), { recursive: true })
    writeFileSync(join(repoDir, '.git', 'info', 'exclude'), 'scratch/')

    ensureGitExcludesHandoff(repoDir)

    expect(readFileSync(join(repoDir, '.git', 'info', 'exclude'), 'utf-8')).toBe('scratch/\n.review-feedback/\n')
  })

  it('writes to the shared exclude file when the repo is a worktree', () => {
    git(repoDir, '-c', 'user.email=a@b.c', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'init')
    const worktreeDir = join(workDir, 'worktree')
    git(repoDir, 'worktree', 'add', '-q', '-b', 'side', worktreeDir)

    expect(ensureGitExcludesHandoff(worktreeDir)).toBe(true)

    expect(readFileSync(join(repoDir, '.git', 'info', 'exclude'), 'utf-8')).toContain('.review-feedback/')
  })

  it('returns false when the path is not a git repo', () => {
    const plainDir = join(workDir, 'plain')
    mkdirSync(plainDir)

    expect(ensureGitExcludesHandoff(plainDir)).toBe(false)
  })

  it('returns false when the path does not exist', () => {
    expect(ensureGitExcludesHandoff(join(workDir, 'missing'))).toBe(false)
  })
})

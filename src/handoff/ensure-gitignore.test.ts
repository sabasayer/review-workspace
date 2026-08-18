import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ensureGitignoreExcludesHandoff } from './ensure-gitignore.ts'

let repoDir: string

beforeEach(() => {
  repoDir = mkdtempSync(join(tmpdir(), 'review-workspace-gitignore-'))
})

afterEach(() => {
  rmSync(repoDir, { recursive: true, force: true })
})

describe('ensureGitignoreExcludesHandoff', () => {
  it('creates .gitignore with the entry when none exists', () => {
    ensureGitignoreExcludesHandoff(repoDir)

    const gitignorePath = join(repoDir, '.gitignore')
    expect(existsSync(gitignorePath)).toBe(true)
    expect(readFileSync(gitignorePath, 'utf-8')).toBe('.review-feedback/\n')
  })

  it('appends the entry to an existing .gitignore that does not cover it', () => {
    const gitignorePath = join(repoDir, '.gitignore')
    writeFileSync(gitignorePath, 'node_modules/\ndist/\n')

    ensureGitignoreExcludesHandoff(repoDir)

    expect(readFileSync(gitignorePath, 'utf-8')).toBe('node_modules/\ndist/\n.review-feedback/\n')
  })

  it('adds a trailing newline before appending when the file did not end with one', () => {
    const gitignorePath = join(repoDir, '.gitignore')
    writeFileSync(gitignorePath, 'node_modules/')

    ensureGitignoreExcludesHandoff(repoDir)

    expect(readFileSync(gitignorePath, 'utf-8')).toBe('node_modules/\n.review-feedback/\n')
  })

  it('does not duplicate the entry when the exact line already exists', () => {
    const gitignorePath = join(repoDir, '.gitignore')
    writeFileSync(gitignorePath, 'node_modules/\n.review-feedback/\n')

    ensureGitignoreExcludesHandoff(repoDir)

    expect(readFileSync(gitignorePath, 'utf-8')).toBe('node_modules/\n.review-feedback/\n')
  })

  it('treats a bare directory name without the trailing slash as already covering it', () => {
    const gitignorePath = join(repoDir, '.gitignore')
    writeFileSync(gitignorePath, '.review-feedback\n')

    ensureGitignoreExcludesHandoff(repoDir)

    expect(readFileSync(gitignorePath, 'utf-8')).toBe('.review-feedback\n')
  })

  it('treats a broader wildcard entry as already covering it', () => {
    const gitignorePath = join(repoDir, '.gitignore')
    writeFileSync(gitignorePath, '.review-feedback/**\n')

    ensureGitignoreExcludesHandoff(repoDir)

    expect(readFileSync(gitignorePath, 'utf-8')).toBe('.review-feedback/**\n')
  })
})

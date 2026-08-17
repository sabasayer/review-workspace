import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readReviewState, writeReviewState } from './review-state.ts'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'review-workspace-state-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('review state', () => {
  it('returns the empty default state when state.json does not exist', () => {
    expect(readReviewState(dir)).toEqual({ groups: {}, notes: [], decision: 'unset' })
  })

  it('persists and reloads understanding and verification per Behavioral Group, distinctly', () => {
    const state = readReviewState(dir)
    state.groups['bg-1'] = { understood: true, verified: false }
    writeReviewState(dir, state)

    const reloaded = readReviewState(dir)
    expect(reloaded.groups['bg-1']).toEqual({ understood: true, verified: false })
  })

  it('survives a fresh read after being written (simulated restart)', () => {
    writeReviewState(dir, {
      groups: { 'bg-1': { understood: true, verified: true } },
      notes: ['looks fine overall'],
      decision: 'approve',
    })

    const reloaded = readReviewState(dir)
    expect(reloaded.decision).toBe('approve')
    expect(reloaded.notes).toEqual(['looks fine overall'])
  })
})

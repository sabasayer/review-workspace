import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parsePatch } from '../patch/parse.ts'
import { readQuestions } from '../questions/questions-log.ts'
import { evaluateResolution } from './resolution.ts'

function bundlePath(name: string) {
  return fileURLToPath(new URL(`../../fixtures/bundles/${name}/`, import.meta.url))
}

const previousPatch = parsePatch(readFileSync(join(bundlePath('chained-mr-100'), 'changes.diff'), 'utf-8'))
const currentPatch = parsePatch(readFileSync(join(bundlePath('chained-mr-100-r2'), 'changes.diff'), 'utf-8'))
const comments = readQuestions(bundlePath('chained-mr-100'))

function comment(id: string) {
  return comments.find((c) => c.id === id)!
}

describe('evaluateResolution', () => {
  it('claims a comment addressed when the incremental patch changed the hunk containing its Target', () => {
    const resolution = evaluateResolution(comment('cr-retry'), previousPatch, currentPatch)
    expect(resolution).toEqual({
      commentId: 'cr-retry',
      status: 'claimed-addressed',
      evidence: expect.stringContaining('changed in the incremental patch'),
    })
  })

  it('claims a comment not addressed when its file has no incremental changes', () => {
    const resolution = evaluateResolution(comment('cr-logging'), previousPatch, currentPatch)
    expect(resolution).toEqual({
      commentId: 'cr-logging',
      status: 'claimed-not-addressed',
      evidence: expect.stringContaining('no incremental changes'),
    })
  })

  it('reports target-gone when the Target no longer resolves against the round\'s patch', () => {
    const resolution = evaluateResolution(comment('cr-legacy'), previousPatch, currentPatch)
    expect(resolution.status).toBe('target-gone')
    expect(resolution.evidence).toContain('no longer resolves')
  })

  it('claims a comment partially addressed when its file changed elsewhere but not at its exact Target', () => {
    const fileTargetComment = {
      id: 'cr-file',
      createdAt: '2026-01-01T00:00:00.000Z',
      body: 'please double check this whole file',
      kind: 'change-request' as const,
      status: 'open' as const,
      resolved: false,
      target: { type: 'file' as const, path: 'src/retry.ts' },
    }
    const resolution = evaluateResolution(fileTargetComment, previousPatch, currentPatch)
    expect(resolution.status).toBe('claimed-partial')
  })

  it('claims a targetless comment partially addressed when anything changed in the round', () => {
    const untargeted = {
      id: 'cr-untargeted',
      createdAt: '2026-01-01T00:00:00.000Z',
      body: 'general concern',
      kind: 'change-request' as const,
      status: 'open' as const,
      resolved: false,
    }
    expect(evaluateResolution(untargeted, previousPatch, currentPatch).status).toBe('claimed-partial')
  })

  it('claims a targetless comment not addressed when nothing changed since the previous round', () => {
    const untargeted = {
      id: 'cr-untargeted',
      createdAt: '2026-01-01T00:00:00.000Z',
      body: 'general concern',
      kind: 'change-request' as const,
      status: 'open' as const,
      resolved: false,
    }
    expect(evaluateResolution(untargeted, previousPatch, previousPatch).status).toBe('claimed-not-addressed')
  })
})

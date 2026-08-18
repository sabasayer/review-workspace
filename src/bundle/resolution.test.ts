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
  it('reports target-touched when the incremental patch changed the hunk containing its Target — a mechanical signal only, not a judgment the concern was actually addressed', () => {
    const resolution = evaluateResolution(comment('cr-retry'), previousPatch, currentPatch)
    expect(resolution).toEqual({
      commentId: 'cr-retry',
      status: 'target-touched',
      evidence: expect.stringContaining('changed in the incremental patch'),
    })
    // This is the fixture where round 2's fix adds three unconditional retries with no
    // backoff at all — the requested change was NOT made. `target-touched` only claims
    // the hunk changed, never that the concern was resolved; that judgment is out of
    // scope for this mechanical signal (see resolution.ts).
  })

  it('reports target-untouched when its file has no incremental changes', () => {
    const resolution = evaluateResolution(comment('cr-logging'), previousPatch, currentPatch)
    expect(resolution).toEqual({
      commentId: 'cr-logging',
      status: 'target-untouched',
      evidence: expect.stringContaining('no incremental changes'),
    })
  })

  it('reports target-gone when the Target no longer resolves against the round\'s patch', () => {
    const resolution = evaluateResolution(comment('cr-legacy'), previousPatch, currentPatch)
    expect(resolution.status).toBe('target-gone')
    expect(resolution.evidence).toContain('no longer resolves')
  })

  it('reports target-partially-touched when its file changed elsewhere but not at its exact Target', () => {
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
    expect(resolution.status).toBe('target-partially-touched')
  })

  it('reports target-partially-touched for a targetless comment when anything changed in the round', () => {
    const untargeted = {
      id: 'cr-untargeted',
      createdAt: '2026-01-01T00:00:00.000Z',
      body: 'general concern',
      kind: 'change-request' as const,
      status: 'open' as const,
      resolved: false,
    }
    expect(evaluateResolution(untargeted, previousPatch, currentPatch).status).toBe('target-partially-touched')
  })

  it('reports target-untouched for a targetless comment when nothing changed since the previous round', () => {
    const untargeted = {
      id: 'cr-untargeted',
      createdAt: '2026-01-01T00:00:00.000Z',
      body: 'general concern',
      kind: 'change-request' as const,
      status: 'open' as const,
      resolved: false,
    }
    expect(evaluateResolution(untargeted, previousPatch, previousPatch).status).toBe('target-untouched')
  })
})

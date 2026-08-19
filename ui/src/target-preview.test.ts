import { describe, expect, it } from 'vitest'
import { resolveTargetPreview } from './target-preview.ts'
import type { RenderedFile, RenderedLine } from './types.ts'

function line(kind: RenderedLine['kind'], oldLine?: number, newLine?: number): RenderedLine {
  return {
    id: `${kind}-${oldLine ?? ''}-${newLine ?? ''}`,
    kind,
    text: kind,
    oldLine,
    newLine,
    overflowsInline: false,
    annotations: [],
    diagnostics: [],
  }
}

const files: RenderedFile[] = [
  {
    path: 'src/auth/login.ts',
    binary: false,
    verification: [],
    hunks: [
      {
        oldStart: 40,
        oldLines: 4,
        newStart: 40,
        newLines: 8,
        lines: [
          line('context', 40, 40),
          line('context', 41, 41),
          line('add', undefined, 42),
          line('context', 42, 43),
        ],
      },
    ],
    annotations: [],
    imageEvidence: [],
    pipelineEvidence: [],
    diagnostics: [],
  },
]

describe('resolveTargetPreview', () => {
  it('returns hunk lines for a hunk target', () => {
    const preview = resolveTargetPreview(files, { type: 'hunk', path: 'src/auth/login.ts', hunkIndex: 0 })
    expect(preview?.lines).toHaveLength(4)
  })

  it('returns surrounding context for a line target', () => {
    const preview = resolveTargetPreview(files, {
      type: 'line',
      path: 'src/auth/login.ts',
      side: 'head',
      line: 42,
      expectedText: 'if (attempts > MAX_ATTEMPTS) {',
    })
    expect(preview?.lines.length).toBeGreaterThan(0)
    expect(preview?.lines.some((l) => l.newLine === 42)).toBe(true)
  })

  it('returns null for file targets', () => {
    expect(resolveTargetPreview(files, { type: 'file', path: 'src/auth/login.ts' })).toBeNull()
  })

  it('returns null when the file is missing', () => {
    expect(
      resolveTargetPreview(files, { type: 'hunk', path: 'src/missing.ts', hunkIndex: 0 }),
    ).toBeNull()
  })
})

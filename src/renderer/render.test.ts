import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { validateBundle } from '../bundle/validate-bundle.ts'
import { buildGeneratorPrompt, render, toInlineRows, toSideBySideRows } from './render.ts'
import type { ReviewDocument } from '../schema/types.ts'
import type { ParsedPatch } from '../patch/types.ts'

function bundlePath(name: string) {
  return fileURLToPath(new URL(`../../fixtures/bundles/${name}/`, import.meta.url))
}

describe('render', () => {
  it('orders files by Behavioral Group order, then falls back to patch order for ungrouped files', () => {
    const dir = bundlePath('diagnostics')
    const result = validateBundle(dir)
    const vm = render(result.document as ReviewDocument, result.patch!, result.diagnostics!, dir)
    // The only group covers src/does-not-exist.ts (unresolved) — real patch file
    // src/auth/login.ts isn't in any group, so it falls back to patch order.
    expect(vm.files.map((f) => f.path)).toEqual(['src/auth/login.ts'])
  })

  it('produces a deterministic order across repeated calls on the same input', () => {
    const dir = bundlePath('valid')
    const result = validateBundle(dir)
    const first = render(result.document as ReviewDocument, result.patch!, result.diagnostics!, dir)
    const second = render(result.document as ReviewDocument, result.patch!, result.diagnostics!, dir)
    expect(first.files.map((f) => f.path)).toEqual(second.files.map((f) => f.path))
  })

  it('carries an Annotation\'s relatedTargets through onto the embedded RenderedFile annotation', () => {
    const document: ReviewDocument = {
      schemaVersion: 1,
      comparison: { base: 'a', head: 'b' },
      annotations: [
        {
          id: 'an-1',
          target: { type: 'file', path: 'src/a.ts' },
          summary: 'depends on a change in src/b.ts',
          relatedTargets: [{ target: { type: 'file', path: 'src/b.ts' }, reason: 'shared contract' }],
        },
      ],
    }
    const patch: ParsedPatch = { files: [{ path: 'src/a.ts', binary: false, hunks: [] }] }
    const vm = render(document, patch, [], '/tmp/fake-bundle')
    expect(vm.files[0].annotations[0].relatedTargets).toEqual([
      { target: { type: 'file', path: 'src/b.ts' }, reason: 'shared contract' },
    ])
  })

  it('carries risk through onto RenderedGroup', () => {
    const document: ReviewDocument = {
      schemaVersion: 1,
      comparison: { base: 'a', head: 'b' },
      behavioralGroups: [{ id: 'bg-1', title: 'Group 1', order: 0, risk: 'high', targets: [] }],
    }
    const patch: ParsedPatch = { files: [] }
    const vm = render(document, patch, [], '/tmp/fake-bundle')
    expect(vm.groups[0].risk).toBe('high')
  })

  it('orders grouped files by group order and ungrouped files by patch order', () => {
    const document: ReviewDocument = {
      schemaVersion: 1,
      comparison: { base: 'a', head: 'b' },
      behavioralGroups: [{ id: 'bg-1', title: 'Group 1', order: 0, targets: [{ type: 'file', path: 'src/b.ts' }] }],
    }
    const patch: ParsedPatch = {
      files: [
        { path: 'src/a.ts', binary: false, hunks: [] },
        { path: 'src/b.ts', binary: false, hunks: [] },
        { path: 'src/c.ts', binary: false, hunks: [] },
      ],
    }
    const vm = render(document, patch, [], '/tmp/fake-bundle')
    expect(vm.files.map((f) => f.path)).toEqual(['src/b.ts', 'src/a.ts', 'src/c.ts'])
  })

  it('attaches a stale-line-target Diagnostic to the specific line it concerns', () => {
    const dir = bundlePath('diagnostics')
    const result = validateBundle(dir)
    const vm = render(result.document as ReviewDocument, result.patch!, result.diagnostics!, dir)
    const file = vm.files.find((f) => f.path === 'src/auth/login.ts')!
    const line = file.hunks.flatMap((h) => h.lines).find((l) => l.newLine === 42)!
    expect(line.diagnostics).toContainEqual(expect.objectContaining({ kind: 'stale-line-target' }))
  })

  it('attaches file-level Diagnostics (e.g. invalid-field, missing-asset) at the bundle level when they have no file path', () => {
    const dir = bundlePath('diagnostics')
    const result = validateBundle(dir)
    const vm = render(result.document as ReviewDocument, result.patch!, result.diagnostics!, dir)
    expect(vm.diagnostics).toContainEqual(expect.objectContaining({ kind: 'missing-asset' }))
    expect(vm.diagnostics).toContainEqual(expect.objectContaining({ kind: 'invalid-field' }))
  })

  it('marks lines over the overflow threshold instead of ever splitting a logical line into two rows', () => {
    const patch: ParsedPatch = {
      files: [
        {
          path: 'a.ts',
          binary: false,
          hunks: [
            {
              oldStart: 1,
              oldLines: 1,
              newStart: 1,
              newLines: 1,
              lines: [{ kind: 'add', text: 'x'.repeat(200), newLine: 1 }],
            },
          ],
        },
      ],
    }
    const document: ReviewDocument = { schemaVersion: 1, comparison: { base: 'a', head: 'b' } }
    const vm = render(document, patch, [], '/tmp/fake-bundle')
    expect(vm.files[0].hunks[0].lines).toHaveLength(1)
    expect(vm.files[0].hunks[0].lines[0].overflowsInline).toBe(true)
  })

  it('inline and side-by-side layouts expose exactly the same underlying line objects', () => {
    const dir = bundlePath('valid')
    const result = validateBundle(dir)
    const vm = render(result.document as ReviewDocument, result.patch!, result.diagnostics!, dir)
    const file = vm.files[0]
    const flatHunkLines = file.hunks.flatMap((h) => h.lines)
    const inline = toInlineRows(flatHunkLines)
    const sideBySide = toSideBySideRows(flatHunkLines)

    expect(inline).toBe(flatHunkLines) // same array reference

    const sideBySideLineIds = new Set(
      sideBySide.flatMap((row) => [row.left, row.right]).filter((l): l is NonNullable<typeof l> => l !== null),
    )
    expect(sideBySideLineIds.size).toBe(inline.length)
    for (const line of inline) {
      expect(sideBySideLineIds.has(line)).toBe(true)
    }
  })

  it('produces a view model for a 100-file, 20,000-line synthetic patch within 2 seconds', () => {
    const files = Array.from({ length: 100 }, (_, fileIndex) => {
      const linesPerHunk = 200
      const lines = Array.from({ length: linesPerHunk }, (_, i) => ({
        kind: 'context' as const,
        text: `line ${i} of file ${fileIndex}`,
        oldLine: i + 1,
        newLine: i + 1,
      }))
      return {
        path: `src/file-${fileIndex}.ts`,
        binary: false,
        hunks: [{ oldStart: 1, oldLines: linesPerHunk, newStart: 1, newLines: linesPerHunk, lines }],
      }
    })
    const patch: ParsedPatch = { files }
    const document: ReviewDocument = { schemaVersion: 1, comparison: { base: 'a', head: 'b' } }

    const start = performance.now()
    const vm = render(document, patch, [], '/tmp/fake-bundle')
    const elapsed = performance.now() - start

    expect(vm.files).toHaveLength(100)
    expect(elapsed).toBeLessThan(2000)
  })

  it('only populates comparisonModes when Evidence has both assetPath and baseAssetPath', () => {
    const dir = bundlePath('image-pair')
    const result = validateBundle(dir)
    const vm = render(result.document as ReviewDocument, result.patch!, result.diagnostics!, dir)
    const file = vm.files.find((f) => f.path === 'assets/logo.png')!
    const paired = file.imageEvidence.find((e) => e.id === 'ev-paired')!
    const single = file.imageEvidence.find((e) => e.id === 'ev-single')!
    expect(paired.comparisonModes).toEqual(['side-by-side', 'swipe', 'onion-skin', 'changed-pixel'])
    expect(paired.baseAssetPath).toBe('snapshot/base.png')
    expect(single.comparisonModes).toEqual([])
    expect(single.baseAssetPath).toBeUndefined()
  })

  it('extracts pipeline Evidence targeting a file onto that RenderedFile', () => {
    const document: ReviewDocument = {
      schemaVersion: 1,
      comparison: { base: 'a', head: 'b' },
      evidence: [
        {
          id: 'ev-ci-failure',
          kind: 'observed',
          description: 'visual-settings E2E failed on this file',
          targetIds: ['src/a.ts'],
          pipeline: { jobName: 'visual-settings', status: 'failed', url: 'https://example.com/jobs/1', logExcerpt: 'expected 8px, got 10px' },
        },
      ],
    }
    const patch: ParsedPatch = { files: [{ path: 'src/a.ts', binary: false, hunks: [] }] }
    const vm = render(document, patch, [], '/tmp/fake-bundle')
    expect(vm.files[0].pipelineEvidence).toEqual([
      {
        id: 'ev-ci-failure',
        jobName: 'visual-settings',
        status: 'failed',
        url: 'https://example.com/jobs/1',
        logExcerpt: 'expected 8px, got 10px',
        description: 'visual-settings E2E failed on this file',
      },
    ])
  })

  it("resolves an Annotation's own evidenceIds onto its RenderedAnnotation", () => {
    const document: ReviewDocument = {
      schemaVersion: 1,
      comparison: { base: 'a', head: 'b' },
      annotations: [
        { id: 'an-1', target: { type: 'file', path: 'src/a.ts' }, summary: 'risky change', evidenceIds: ['ev-1', 'ev-missing'] },
      ],
      evidence: [{ id: 'ev-1', kind: 'author-claim', description: 'author says this is safe' }],
    }
    const patch: ParsedPatch = { files: [{ path: 'src/a.ts', binary: false, hunks: [] }] }
    const vm = render(document, patch, [], '/tmp/fake-bundle')
    expect(vm.files[0].annotations[0].evidence).toEqual([{ id: 'ev-1', kind: 'author-claim', description: 'author says this is safe' }])
  })

  it("resolves Verification items whose targetIds name an Annotation onto that Annotation", () => {
    const document: ReviewDocument = {
      schemaVersion: 1,
      comparison: { base: 'a', head: 'b' },
      annotations: [{ id: 'an-1', target: { type: 'file', path: 'src/a.ts' }, summary: 'risky change' }],
      verification: [
        { id: 'ver-1', description: 'covered by a passing test', status: 'verified', targetIds: ['an-1'] },
        { id: 'ver-2', description: 'unrelated to this annotation', status: 'gap', targetIds: ['an-2'] },
      ],
    }
    const patch: ParsedPatch = { files: [{ path: 'src/a.ts', binary: false, hunks: [] }] }
    const vm = render(document, patch, [], '/tmp/fake-bundle')
    expect(vm.files[0].annotations[0].verification).toEqual([{ id: 'ver-1', description: 'covered by a passing test', status: 'verified' }])
  })

  it("resolves a Verification item onto RenderedFile.verification even when its targetIds name only the file path and an Evidence id, no Annotation", () => {
    const document: ReviewDocument = {
      schemaVersion: 1,
      comparison: { base: 'a', head: 'b' },
      annotations: [{ id: 'an-1', target: { type: 'file', path: 'src/a.ts' }, summary: 'risky change' }],
      evidence: [{ id: 'ev-1', kind: 'observed', description: 'pipeline is green', targetIds: ['src/a.ts'] }],
      verification: [{ id: 'ver-1', description: 'the fix actually landed', status: 'verified', targetIds: ['ev-1', 'src/a.ts'] }],
    }
    const patch: ParsedPatch = { files: [{ path: 'src/a.ts', binary: false, hunks: [] }] }
    const vm = render(document, patch, [], '/tmp/fake-bundle')
    expect(vm.files[0].annotations[0].verification).toEqual([])
    expect(vm.files[0].verification).toEqual([{ id: 'ver-1', description: 'the fix actually landed', status: 'verified' }])
  })

  it('deduplicates a Verification item reachable both by file path and by an Annotation id onto RenderedFile.verification', () => {
    const document: ReviewDocument = {
      schemaVersion: 1,
      comparison: { base: 'a', head: 'b' },
      annotations: [{ id: 'an-1', target: { type: 'file', path: 'src/a.ts' }, summary: 'risky change' }],
      verification: [{ id: 'ver-1', description: 'covered', status: 'verified', targetIds: ['an-1', 'src/a.ts'] }],
    }
    const patch: ParsedPatch = { files: [{ path: 'src/a.ts', binary: false, hunks: [] }] }
    const vm = render(document, patch, [], '/tmp/fake-bundle')
    expect(vm.files[0].verification).toEqual([{ id: 'ver-1', description: 'covered', status: 'verified' }])
  })

  it('passes document.answers through onto the view model', () => {
    const dir = bundlePath('dangling-answer')
    const result = validateBundle(dir)
    const vm = render(result.document as ReviewDocument, result.patch!, result.diagnostics!, dir)
    expect(vm.answers).toEqual([
      { id: 'ans-1', questionId: 'q-does-not-exist', body: 'This references a Question that was never raised.' },
    ])
  })

  it('defaults answers to an empty array when the document has none', () => {
    const dir = bundlePath('valid')
    const result = validateBundle(dir)
    const vm = render(result.document as ReviewDocument, result.patch!, result.diagnostics!, dir)
    expect(vm.answers).toEqual([])
  })

  it('exposes a copyable prompt containing the bundle absolute path, available regardless of pending updates', () => {
    const dir = bundlePath('valid')
    const result = validateBundle(dir)
    const vm = render(result.document as ReviewDocument, result.patch!, result.diagnostics!, dir)
    expect(vm.generatorPrompt).toContain('/review-workspace')
    expect(vm.generatorPrompt).toContain(dir.replace(/\/$/, ''))
  })

  it('resolves a relative bundle path to an absolute one in the prompt', () => {
    expect(buildGeneratorPrompt('.')).toContain(process.cwd())
  })

  it('resolves summary highlightAnnotationIds and highlightPaths onto the view model', () => {
    const document: ReviewDocument = {
      schemaVersion: 1,
      comparison: { base: 'a', head: 'b' },
      annotations: [{ id: 'an-1', target: { type: 'file', path: 'src/a.ts' }, summary: 'the important bit' }],
      summary: { text: 'Adds rate limiting.', highlightAnnotationIds: ['an-1'], highlightPaths: ['src/a.ts'] },
    }
    const patch: ParsedPatch = { files: [{ path: 'src/a.ts', binary: false, hunks: [] }] }
    const vm = render(document, patch, [], '/tmp/fake-bundle')
    expect(vm.summary?.text).toBe('Adds rate limiting.')
    expect(vm.summary?.highlightAnnotations).toEqual([
      { id: 'an-1', target: { type: 'file', path: 'src/a.ts' }, summary: 'the important bit', evidence: [], verification: [] },
    ])
    expect(vm.summary?.highlightPaths).toEqual(['src/a.ts'])
  })

  it('drops dangling highlightAnnotationIds and highlightPaths that reference nothing in the document/patch', () => {
    const document: ReviewDocument = {
      schemaVersion: 1,
      comparison: { base: 'a', head: 'b' },
      summary: { text: 'x', highlightAnnotationIds: ['does-not-exist'], highlightPaths: ['does/not/exist.ts'] },
    }
    const patch: ParsedPatch = { files: [] }
    const vm = render(document, patch, [], '/tmp/fake-bundle')
    expect(vm.summary?.highlightAnnotations).toEqual([])
    expect(vm.summary?.highlightPaths).toEqual([])
  })

  it('leaves the view model summary undefined when the document has none', () => {
    const document: ReviewDocument = { schemaVersion: 1, comparison: { base: 'a', head: 'b' } }
    const vm = render(document, { files: [] }, [], '/tmp/fake-bundle')
    expect(vm.summary).toBeUndefined()
  })
})

describe('render — round-N carry-forward', () => {
  const round1Fixture = fileURLToPath(new URL('../../fixtures/bundles/chained-mr-100/', import.meta.url))
  const round2Fixture = fileURLToPath(new URL('../../fixtures/bundles/chained-mr-100-r2/', import.meta.url))

  let workParent: string
  let round2: string

  beforeEach(() => {
    workParent = mkdtempSync(join(tmpdir(), 'review-workspace-render-carry-'))
    cpSync(round1Fixture, join(workParent, 'chained-mr-100'), { recursive: true })
    round2 = join(workParent, 'chained-mr-100-r2')
    cpSync(round2Fixture, round2, { recursive: true })
  })

  afterEach(() => {
    rmSync(workParent, { recursive: true, force: true })
  })

  it('reports round 1 for a bundle with no chain.json', () => {
    const dir = bundlePath('valid')
    const result = validateBundle(dir)
    const vm = render(result.document as ReviewDocument, result.patch!, result.diagnostics ?? [], dir)
    expect(vm.round).toBe(1)
  })

  it('reports the round number from chain.json for a round-N bundle', () => {
    const result = validateBundle(round2)
    const vm = render(result.document as ReviewDocument, result.patch!, result.diagnostics ?? [], round2)
    expect(vm.round).toBe(2)
  })

  it('carries forward a Behavioral Group and Annotation for a file the incremental patch does not touch', () => {
    const result = validateBundle(round2)
    const vm = render(result.document as ReviewDocument, result.patch!, result.diagnostics ?? [], round2)

    expect(vm.groups.map((g) => g.id)).toContain('bg-logging')
    const loggingFile = vm.files.find((f) => f.path === 'src/logging.ts')!
    expect(loggingFile.annotations.map((a) => a.id)).toContain('an-logging')
  })

  it('does not carry forward an Annotation for a file the incremental patch touches, keeping only the round\'s fresh one', () => {
    const result = validateBundle(round2)
    const vm = render(result.document as ReviewDocument, result.patch!, result.diagnostics ?? [], round2)

    const retryFile = vm.files.find((f) => f.path === 'src/retry.ts')!
    expect(retryFile.annotations.map((a) => a.id)).toEqual(['an-retry-2'])
  })
})

describe('no Generator is ever launched by this codebase', () => {
  it('the renderer and server source contain no process-spawn or AI-API call sites', () => {
    const files = [
      fileURLToPath(new URL('./render.ts', import.meta.url)),
      fileURLToPath(new URL('../server/create-server.ts', import.meta.url)),
      fileURLToPath(new URL('../bundle/validate-bundle.ts', import.meta.url)),
      fileURLToPath(new URL('../bundle/publish.ts', import.meta.url)),
    ]
    // 'exec(' is deliberately excluded — RegExp.exec() is a legitimate, unrelated API this codebase uses.
    const forbidden = ['child_process', 'spawn(', 'execfile(', 'anthropic', 'openai', 'api.anthropic', 'ANTHROPIC_API_KEY']
    for (const file of files) {
      const source = readFileSync(file, 'utf-8').toLowerCase()
      for (const term of forbidden) {
        expect(source).not.toContain(term.toLowerCase())
      }
    }
  })
})

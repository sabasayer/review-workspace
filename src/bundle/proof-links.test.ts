import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parsePatch } from '../patch/parse.ts'
import type { Annotation, Evidence, ReviewDocument } from '../schema/types.ts'
import { findProofLinks } from './proof-links.ts'

const patch = parsePatch(readFileSync(new URL('../../fixtures/bundles/proof-link/changes.diff', import.meta.url), 'utf-8'))

function documentWith(annotations: Annotation[], evidence: Evidence[]): ReviewDocument {
  return { schemaVersion: 2, comparison: { base: 'a', head: 'b' }, annotations, evidence }
}

const hunkNote: Annotation = { id: 'an-1', target: { type: 'hunk', path: 'src/components/Logo.vue', hunkIndex: 0 }, summary: 's' }
const proof = (targetIds: string[]): Evidence => ({ id: 'ev-1', kind: 'observed', description: 'd', targetIds, assetPath: 'x.png' })

describe('findProofLinks', () => {
  it('links the hunk of an Annotation to the changed image', () => {
    const result = findProofLinks(documentWith([hunkNote], [proof(['an-1', 'assets/logo.png'])]), patch)
    expect(result.diagnostics).toEqual([])
    expect(result.links).toEqual([
      { evidenceId: 'ev-1', imagePath: 'assets/logo.png', code: { path: 'src/components/Logo.vue', hunkIndex: 0, annotationId: 'an-1' } },
    ])
  })

  it('finds the hunk that holds the line of a line Annotation', () => {
    const lineNote: Annotation = {
      id: 'an-2',
      target: { type: 'line', path: 'src/components/Logo.vue', side: 'head', line: 2, expectedText: '  <img src="/assets/logo.png" alt="Logo" />' },
      summary: 's',
    }
    const result = findProofLinks(documentWith([lineNote], [proof(['an-2', 'assets/logo.png'])]), patch)
    expect(result.links[0].code).toEqual({ path: 'src/components/Logo.vue', hunkIndex: 0, annotationId: 'an-2' })
  })

  it('links a file path to the image at file level', () => {
    const result = findProofLinks(documentWith([], [proof(['src/components/Logo.vue', 'assets/logo.png'])]), patch)
    expect(result.links).toEqual([{ evidenceId: 'ev-1', imagePath: 'assets/logo.png', code: { path: 'src/components/Logo.vue' } }])
  })

  it('links a file-level Annotation without a hunk', () => {
    const fileNote: Annotation = { id: 'an-3', target: { type: 'file', path: 'src/components/Logo.vue' }, summary: 's' }
    const result = findProofLinks(documentWith([fileNote], [proof(['an-3', 'assets/logo.png'])]), patch)
    expect(result.links[0].code).toEqual({ path: 'src/components/Logo.vue', annotationId: 'an-3' })
  })

  it('makes one link for each code Target', () => {
    const result = findProofLinks(documentWith([hunkNote], [proof(['an-1', 'src/components/Logo.vue', 'assets/logo.png'])]), patch)
    expect(result.links).toHaveLength(2)
  })

  it('ignores image Evidence that names no code Target', () => {
    const result = findProofLinks(documentWith([], [proof(['assets/logo.png'])]), patch)
    expect(result).toEqual({ links: [], diagnostics: [] })
  })

  it('ignores Evidence that names no image', () => {
    const result = findProofLinks(documentWith([hunkNote], [proof(['an-1'])]), patch)
    expect(result).toEqual({ links: [], diagnostics: [] })
  })

  it('ignores Evidence with no targetIds', () => {
    const result = findProofLinks(documentWith([], [{ id: 'ev-1', kind: 'observed', description: 'd' }]), patch)
    expect(result).toEqual({ links: [], diagnostics: [] })
  })

  it('reports an image that is not a changed image in the patch', () => {
    const result = findProofLinks(documentWith([hunkNote], [proof(['an-1', 'assets/other.png'])]), patch)
    expect(result.links).toEqual([])
    expect(result.diagnostics).toEqual([
      { kind: 'invalid-proof-link', evidenceId: 'ev-1', detail: 'image assets/other.png is not a changed image in the patch' },
    ])
  })

  it('reports a proof whose Evidence has no assetPath', () => {
    const noAsset: Evidence = { id: 'ev-1', kind: 'observed', description: 'd', targetIds: ['an-1', 'assets/logo.png'] }
    const result = findProofLinks(documentWith([hunkNote], [noAsset]), patch)
    expect(result.links).toEqual([])
    expect(result.diagnostics).toEqual([
      { kind: 'invalid-proof-link', evidenceId: 'ev-1', detail: 'the evidence has no assetPath, so there is no image to show' },
    ])
  })

  it('reports a code Target that does not exist', () => {
    const result = findProofLinks(documentWith([], [proof(['an-9', 'assets/logo.png'])]), patch)
    expect(result.links).toEqual([])
    expect(result.diagnostics).toEqual([
      { kind: 'invalid-proof-link', evidenceId: 'ev-1', detail: 'no code Target found for an-9 (use an Annotation id or a changed file path)' },
    ])
  })

  it('does not treat a general Annotation as a code Target', () => {
    const general: Annotation = { id: 'an-4', target: { type: 'general' }, summary: 's' }
    const result = findProofLinks(documentWith([general], [proof(['an-4', 'assets/logo.png'])]), patch)
    expect(result.diagnostics).toHaveLength(1)
  })

  it('does not treat an Annotation on the image itself as a code Target', () => {
    const imageNote: Annotation = { id: 'an-5', target: { type: 'binary', path: 'assets/logo.png' }, summary: 's' }
    const result = findProofLinks(documentWith([imageNote], [proof(['an-5', 'assets/logo.png'])]), patch)
    expect(result).toEqual({ links: [], diagnostics: [] })
  })
})

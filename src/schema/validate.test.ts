import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { validateReviewDocumentSchema } from './validate.ts'

function loadFixture(name: string) {
  return JSON.parse(readFileSync(new URL(`../../fixtures/${name}/review.json`, import.meta.url), 'utf-8'))
}

describe('validateReviewDocumentSchema', () => {
  it('accepts a minimal document with only Comparison identity', () => {
    const result = validateReviewDocumentSchema(loadFixture('minimal-valid'))
    expect(result.valid).toBe(true)
  })

  it('accepts a fully-enriched document', () => {
    const result = validateReviewDocumentSchema(loadFixture('fully-enriched'))
    expect(result.valid).toBe(true)
  })

  it('accepts a Behavioral Group with a valid risk level', () => {
    const doc = loadFixture('fully-enriched')
    expect(doc.behavioralGroups[0].risk).toBe('high')
    expect(validateReviewDocumentSchema(doc).valid).toBe(true)
  })

  it('accepts an Evidence entry with a baseAssetPath alongside assetPath', () => {
    const doc = loadFixture('minimal-valid')
    doc.evidence = [
      { id: 'ev-1', kind: 'observed', description: 'x', assetPath: 'head.png', baseAssetPath: 'base.png' },
    ]
    expect(validateReviewDocumentSchema(doc).valid).toBe(true)
  })

  it('accepts an Intent with sources and rejects one without', () => {
    const doc = loadFixture('minimal-valid')
    doc.intent = { does: 'Adds a limiter.', why: 'Stops brute force.', doesNot: ['No UI change.'], sources: ['MR text'] }
    expect(validateReviewDocumentSchema(doc).valid).toBe(true)
    doc.intent.sources = []
    expect(validateReviewDocumentSchema(doc).valid).toBe(false)
  })

  it('rejects a Behavioral Group with an invalid risk level', () => {
    const doc = loadFixture('minimal-valid')
    doc.behavioralGroups = [{ id: 'bg-1', title: 'x', order: 0, risk: 'critical' }]
    expect(validateReviewDocumentSchema(doc).valid).toBe(false)
  })

  it('rejects a document missing Comparison identity', () => {
    const result = validateReviewDocumentSchema({ schemaVersion: 1 })
    expect(result.valid).toBe(false)
    expect(result.errors?.length).toBeGreaterThan(0)
  })

  it('accepts a summary with highlight annotation ids and paths', () => {
    const doc = loadFixture('minimal-valid')
    doc.summary = { text: 'Adds rate limiting.', highlightAnnotationIds: ['an-1'], highlightPaths: ['src/a.ts'] }
    expect(validateReviewDocumentSchema(doc).valid).toBe(true)
  })

  it('rejects a summary missing text', () => {
    const doc = loadFixture('minimal-valid')
    doc.summary = { highlightAnnotationIds: ['an-1'] }
    expect(validateReviewDocumentSchema(doc).valid).toBe(false)
  })

  it('rejects a line Target missing expectedText', () => {
    const doc = loadFixture('minimal-valid')
    doc.annotations = [
      {
        id: 'an-1',
        target: { type: 'line', path: 'a.ts', side: 'head', line: 1 },
        summary: 'missing expectedText',
      },
    ]
    const result = validateReviewDocumentSchema(doc)
    expect(result.valid).toBe(false)
  })

  describe('note fields', () => {
    function withNote(note: Record<string, unknown>) {
      const doc = loadFixture('minimal-valid')
      doc.annotations = [{ id: 'an-1', target: { type: 'file', path: 'a.ts' }, summary: 's', ...note }]
      return doc
    }

    it('accepts a verdict, severity, source and suggestion', () => {
      const doc = withNote({ verdict: 'wrong', severity: 'high', source: 'repo-rule', suggestion: 'Use the config value.' })
      expect(validateReviewDocumentSchema(doc).valid).toBe(true)
    })

    it.each([
      ['verdict', 'bad'],
      ['severity', 'critical'],
      ['source', 'someone'],
    ])('rejects an unknown %s', (field, value) => {
      expect(validateReviewDocumentSchema(withNote({ [field]: value })).valid).toBe(false)
    })

    it('rejects an empty suggestion', () => {
      expect(validateReviewDocumentSchema(withNote({ suggestion: '' })).valid).toBe(false)
    })
  })

  describe('general Target', () => {
    it('accepts a general Target on an Annotation', () => {
      const doc = loadFixture('minimal-valid')
      doc.annotations = [{ id: 'an-1', target: { type: 'general' }, summary: 's' }]
      expect(validateReviewDocumentSchema(doc).valid).toBe(true)
    })

    it('still needs a path on a code Target', () => {
      const doc = loadFixture('minimal-valid')
      doc.annotations = [{ id: 'an-1', target: { type: 'file' }, summary: 's' }]
      expect(validateReviewDocumentSchema(doc).valid).toBe(false)
    })

    it('rejects a general Target in a Behavioral Group', () => {
      const doc = loadFixture('minimal-valid')
      doc.behavioralGroups = [{ id: 'bg-1', title: 'x', order: 0, targets: [{ type: 'general' }] }]
      expect(validateReviewDocumentSchema(doc).valid).toBe(false)
    })
  })

  describe('Intent visuals', () => {
    const intent = { does: 'a', why: 'b', sources: ['MR text'] }

    function withVisuals(visuals: unknown) {
      const doc = loadFixture('minimal-valid')
      doc.intent = { ...intent, visuals }
      return doc
    }

    it('accepts an MR-text image and a snapshot pair', () => {
      const doc = withVisuals([
        { assetPath: 'a.png', caption: 'c', source: 'mr-text' },
        { assetPath: 'head.png', baseAssetPath: 'base.png', caption: 'c', source: 'snapshot' },
      ])
      expect(validateReviewDocumentSchema(doc).valid).toBe(true)
    })

    it('rejects a visual with no caption', () => {
      expect(validateReviewDocumentSchema(withVisuals([{ assetPath: 'a.png', source: 'mr-text' }])).valid).toBe(false)
    })

    it('rejects an unknown source', () => {
      expect(validateReviewDocumentSchema(withVisuals([{ assetPath: 'a.png', caption: 'c', source: 'agent' }])).valid).toBe(false)
    })

    it('rejects a base image on an MR-text visual', () => {
      const doc = withVisuals([{ assetPath: 'a.png', baseAssetPath: 'b.png', caption: 'c', source: 'mr-text' }])
      expect(validateReviewDocumentSchema(doc).valid).toBe(false)
    })

    it('does not limit the number of visuals', () => {
      const visuals = Array.from({ length: 5 }, (_, i) => ({ assetPath: `${i}.png`, caption: 'c', source: 'mr-text' }))
      expect(validateReviewDocumentSchema(withVisuals(visuals)).valid).toBe(true)
    })
  })
})

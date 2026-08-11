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
})

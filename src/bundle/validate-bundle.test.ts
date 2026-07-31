import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { validateBundle } from './validate-bundle.ts'

function bundlePath(name: string) {
  return fileURLToPath(new URL(`../../fixtures/bundles/${name}/`, import.meta.url))
}

describe('validateBundle', () => {
  it('accepts a fully valid bundle', () => {
    const result = validateBundle(bundlePath('valid'))
    expect(result.valid).toBe(true)
    expect(result.document).toBeDefined()
    expect(result.patch?.files).toHaveLength(1)
  })

  it('blocks on unparseable review.json', () => {
    const result = validateBundle(bundlePath('unparseable-json'))
    expect(result.valid).toBe(false)
    expect(result.blockingReason).toBe('unparseable-json')
  })

  it('blocks on an unsupported schemaVersion', () => {
    const result = validateBundle(bundlePath('unsupported-schema-version'))
    expect(result.valid).toBe(false)
    expect(result.blockingReason).toBe('unsupported-schema-version')
  })

  it('blocks on missing Comparison identity', () => {
    const result = validateBundle(bundlePath('missing-comparison-identity'))
    expect(result.valid).toBe(false)
    expect(result.blockingReason).toBe('missing-comparison-identity')
  })

  it('blocks on an unusable Unified Patch', () => {
    const result = validateBundle(bundlePath('unusable-patch'))
    expect(result.valid).toBe(false)
    expect(result.blockingReason).toBe('unusable-patch')
  })

  it('is pure: repeated calls on the same path produce the same result', () => {
    const first = validateBundle(bundlePath('valid'))
    const second = validateBundle(bundlePath('valid'))
    expect(first).toEqual(second)
  })
})

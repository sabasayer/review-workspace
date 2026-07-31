import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { validateBundle } from '../bundle/validate-bundle.ts'
import { DEFAULT_LIMITS } from './limits.ts'
import { escapeRawHtml } from './sanitize.ts'
import { resolveAssetPath } from './asset-path.ts'

function bundlePath(name: string) {
  return fileURLToPath(new URL(`../../fixtures/bundles/${name}/`, import.meta.url))
}

describe('asset path containment and type allowlist', () => {
  it('rejects a path traversal attempt without touching the filesystem outside assets/', () => {
    const result = validateBundle(bundlePath('security'))
    expect(result.valid).toBe(true)
    expect(result.diagnostics).toContainEqual({ kind: 'unsafe-asset-path', assetPath: '../../outside.png' })
  })

  it('rejects a disallowed media type', () => {
    const result = validateBundle(bundlePath('security'))
    expect(result.diagnostics).toContainEqual({ kind: 'disallowed-asset-type', assetPath: 'notes.txt' })
  })

  it('flags an asset exceeding the configured size limit', () => {
    const result = validateBundle(bundlePath('security'), { ...DEFAULT_LIMITS, maxAssetBytes: 10 })
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ kind: 'asset-too-large', assetPath: 'big.png' }))
  })

  it('resolveAssetPath never returns a path outside the assets directory', () => {
    const result = resolveAssetPath(bundlePath('security'), '../../../etc/passwd')
    expect(result.ok).toBe(false)
  })
})

describe('size limits', () => {
  it('blocks an oversized review.json', () => {
    const result = validateBundle(bundlePath('valid'), { ...DEFAULT_LIMITS, maxDocumentBytes: 5 })
    expect(result.valid).toBe(false)
    expect(result.blockingReason).toBe('document-too-large')
  })

  it('blocks an oversized changes.diff', () => {
    const result = validateBundle(bundlePath('valid'), { ...DEFAULT_LIMITS, maxPatchBytes: 5 })
    expect(result.valid).toBe(false)
    expect(result.blockingReason).toBe('patch-too-large')
  })

  it('blocks a patch exceeding the configured line-count limit', () => {
    const result = validateBundle(bundlePath('valid'), { ...DEFAULT_LIMITS, maxPatchLines: 1 })
    expect(result.valid).toBe(false)
    expect(result.blockingReason).toBe('too-many-patch-lines')
  })

  it('does not block when a fully valid bundle is within default limits', () => {
    const result = validateBundle(bundlePath('valid'))
    expect(result.valid).toBe(true)
  })
})

describe('escapeRawHtml', () => {
  it('escapes raw HTML tags so they render as literal text', () => {
    expect(escapeRawHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('escapes quotes and ampersands', () => {
    expect(escapeRawHtml(`a & b "c" 'd'`)).toBe('a &amp; b &quot;c&quot; &#39;d&#39;')
  })

  it('leaves plain text untouched', () => {
    expect(escapeRawHtml('just some plain markdown text')).toBe('just some plain markdown text')
  })
})

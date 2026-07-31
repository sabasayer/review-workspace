import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { validateBundle } from './validate-bundle.ts'

function bundlePath(name: string) {
  return fileURLToPath(new URL(`../../fixtures/bundles/${name}/`, import.meta.url))
}

describe('diagnostics', () => {
  it('does not block opening despite every Diagnostic class being present', () => {
    const result = validateBundle(bundlePath('diagnostics'))
    expect(result.valid).toBe(true)
    expect(result.document).toBeDefined()
  })

  it('flags an unresolved file Target', () => {
    const result = validateBundle(bundlePath('diagnostics'))
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ kind: 'unresolved-target', targetType: 'file', path: 'src/does-not-exist.ts' }),
    )
  })

  it('flags an unresolved hunk Target', () => {
    const result = validateBundle(bundlePath('diagnostics'))
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ kind: 'unresolved-target', targetType: 'hunk', path: 'src/auth/login.ts' }),
    )
  })

  it('flags an unresolved binary Target for a non-binary file', () => {
    const result = validateBundle(bundlePath('diagnostics'))
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ kind: 'unresolved-target', targetType: 'binary', path: 'src/auth/login.ts' }),
    )
  })

  it('flags a stale line Target whose expected text no longer matches', () => {
    const result = validateBundle(bundlePath('diagnostics'))
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ kind: 'stale-line-target', path: 'src/auth/login.ts', line: 42 }),
    )
  })

  it('flags a missing referenced asset', () => {
    const result = validateBundle(bundlePath('diagnostics'))
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ kind: 'missing-asset', assetPath: 'missing.png' }))
  })

  it('flags an invalid optional field without dropping the rest of the document', () => {
    const result = validateBundle(bundlePath('diagnostics'))
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ kind: 'invalid-field' }))
    const document = result.document as { annotations: unknown[] }
    expect(document.annotations).toHaveLength(3)
  })

  it('flags an unresolved relatedTarget the same way as a primary Target', () => {
    const result = validateBundle(bundlePath('diagnostics'))
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ kind: 'unresolved-target', targetType: 'file', path: 'src/related-file-does-not-exist.ts' }),
    )
  })

  it('flags an Answer referencing a Question that was never raised', () => {
    const result = validateBundle(bundlePath('dangling-answer'))
    expect(result.valid).toBe(true)
    expect(result.diagnostics).toContainEqual({ kind: 'dangling-answer', answerId: 'ans-1', questionId: 'q-does-not-exist' })
  })

  it('produces no diagnostics for a fully valid bundle', () => {
    const result = validateBundle(bundlePath('valid'))
    expect(result.diagnostics).toEqual([])
  })

  it('produces no diagnostics for a valid Evidence assetPath/baseAssetPath pair', () => {
    const result = validateBundle(bundlePath('image-pair'))
    expect(result.valid).toBe(true)
    expect(result.diagnostics).toEqual([])
  })

  it('flags a missing baseAssetPath the same way as a missing assetPath', () => {
    const workBundle = mkdtempSync(join(tmpdir(), 'image-pair-'))
    cpSync(bundlePath('image-pair'), workBundle, { recursive: true })
    const document = JSON.parse(readFileSync(join(workBundle, 'review.json'), 'utf-8'))
    document.evidence[0].baseAssetPath = 'snapshot/does-not-exist.png'
    writeFileSync(join(workBundle, 'review.json'), JSON.stringify(document))

    const result = validateBundle(workBundle)
    expect(result.diagnostics).toContainEqual({ kind: 'missing-asset', assetPath: 'snapshot/does-not-exist.png' })

    rmSync(workBundle, { recursive: true, force: true })
  })
})

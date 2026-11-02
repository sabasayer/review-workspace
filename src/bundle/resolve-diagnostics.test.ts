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

  it('flags a gap with no targetIds at all', () => {
    const result = validateBundle(bundlePath('diagnostics'))
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ kind: 'unanchored-verification-gap', verificationId: 'vi-empty' }))
  })

  it('flags a gap whose targetIds only name a Behavioral Group, not a place', () => {
    const result = validateBundle(bundlePath('diagnostics'))
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ kind: 'unanchored-verification-gap', verificationId: 'vi-dangling' }))
  })

  it('does not flag a gap marked diffuse', () => {
    const result = validateBundle(bundlePath('diagnostics'))
    expect(result.diagnostics).not.toContainEqual(expect.objectContaining({ verificationId: 'vi-diffuse' }))
  })

  it('does not flag a gap anchored via an Annotation id', () => {
    const result = validateBundle(bundlePath('diagnostics'))
    expect(result.diagnostics).not.toContainEqual(expect.objectContaining({ verificationId: 'vi-anchored-annotation' }))
  })

  it('does not flag a gap anchored via an Evidence id that itself resolves to a file', () => {
    const result = validateBundle(bundlePath('diagnostics'))
    expect(result.diagnostics).not.toContainEqual(expect.objectContaining({ verificationId: 'vi-anchored-evidence' }))
  })

  it('does not flag a dangling targetIds on a non-gap Verification item', () => {
    const result = validateBundle(bundlePath('diagnostics'))
    expect(result.diagnostics).not.toContainEqual(expect.objectContaining({ verificationId: 'vi-unverified-dangling' }))
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
  describe('image without a base and head pair', () => {
    function imagePairBundle(mutate: (document: { evidence: Record<string, unknown>[]; annotations?: unknown[] }) => void) {
      const workBundle = mkdtempSync(join(tmpdir(), 'image-pair-'))
      cpSync(bundlePath('image-pair'), workBundle, { recursive: true })
      const document = JSON.parse(readFileSync(join(workBundle, 'review.json'), 'utf-8'))
      mutate(document)
      writeFileSync(join(workBundle, 'review.json'), JSON.stringify(document))
      return workBundle
    }

    it('flags a changed image whose Evidence has no baseAssetPath', () => {
      const workBundle = imagePairBundle((document) => {
        delete document.evidence[0].baseAssetPath
      })

      const result = validateBundle(workBundle)
      expect(result.diagnostics).toContainEqual({ kind: 'image-without-comparison', path: 'assets/logo.png' })

      rmSync(workBundle, { recursive: true, force: true })
    })

    it('flags a changed image that has no Evidence at all', () => {
      const workBundle = imagePairBundle((document) => {
        document.evidence = []
      })

      const result = validateBundle(workBundle)
      expect(result.diagnostics).toContainEqual({ kind: 'image-without-comparison', path: 'assets/logo.png' })

      rmSync(workBundle, { recursive: true, force: true })
    })

    it('accepts Evidence that reaches the image through an Annotation id', () => {
      const workBundle = imagePairBundle((document) => {
        document.evidence[0].targetIds = ['an-logo']
        document.evidence = [document.evidence[0]]
        document.annotations = [
          { id: 'an-logo', target: { type: 'binary', path: 'assets/logo.png' }, summary: 'New logo.', evidenceIds: [] },
        ]
      })

      const result = validateBundle(workBundle)
      expect(result.diagnostics).not.toContainEqual(expect.objectContaining({ kind: 'image-without-comparison' }))

      rmSync(workBundle, { recursive: true, force: true })
    })

    it('does not flag a new image that has no base blob', () => {
      const workBundle = imagePairBundle((document) => {
        document.evidence = []
      })
      writeFileSync(
        join(workBundle, 'changes.diff'),
        'diff --git a/assets/logo.png b/assets/logo.png\nnew file mode 100644\nindex 0000000..2222222\nBinary files /dev/null and b/assets/logo.png differ\n',
      )

      const result = validateBundle(workBundle)
      expect(result.diagnostics).not.toContainEqual(expect.objectContaining({ kind: 'image-without-comparison' }))

      rmSync(workBundle, { recursive: true, force: true })
    })

    it('does not flag a new image even when an Annotation targets it', () => {
      const workBundle = imagePairBundle((document) => {
        document.evidence = []
        document.annotations = [
          { id: 'an-logo', target: { type: 'binary', path: 'assets/logo.png' }, summary: 'New logo.', evidenceIds: [] },
        ]
      })
      writeFileSync(
        join(workBundle, 'changes.diff'),
        'diff --git a/assets/logo.png b/assets/logo.png\nnew file mode 100644\nindex 0000000..2222222\nBinary files /dev/null and b/assets/logo.png differ\n',
      )

      const result = validateBundle(workBundle)
      expect(result.diagnostics).not.toContainEqual(expect.objectContaining({ kind: 'image-without-comparison' }))

      rmSync(workBundle, { recursive: true, force: true })
    })

    it('does not flag a changed binary file that is not an image type', () => {
      const workBundle = imagePairBundle((document) => {
        document.evidence = []
      })
      writeFileSync(join(workBundle, 'changes.diff'), 'diff --git a/data.bin b/data.bin\nBinary files a/data.bin and b/data.bin differ\n')

      const result = validateBundle(workBundle)
      expect(result.diagnostics).not.toContainEqual(expect.objectContaining({ kind: 'image-without-comparison' }))

      rmSync(workBundle, { recursive: true, force: true })
    })

    it('flags a binary Target of an image type even when the patch lists no such file', () => {
      const workBundle = imagePairBundle((document) => {
        document.evidence = []
        document.annotations = [
          { id: 'an-shot', target: { type: 'binary', path: 'shots/page.PNG' }, summary: 'Page changed.', evidenceIds: [] },
        ]
      })

      const result = validateBundle(workBundle)
      expect(result.diagnostics).toContainEqual({ kind: 'image-without-comparison', path: 'shots/page.PNG' })

      rmSync(workBundle, { recursive: true, force: true })
    })
  })
})

describe('note fields', () => {
  it('produces no diagnostics for notes with verdicts and suggestions', () => {
    const result = validateBundle(bundlePath('general-target'))
    expect(result.valid).toBe(true)
    expect(result.diagnostics).toEqual([])
  })

  it('flags a version 2 note with no verdict and a wrong note with no suggestion', () => {
    const workBundle = mkdtempSync(join(tmpdir(), 'note-fields-'))
    cpSync(bundlePath('general-target'), workBundle, { recursive: true })
    const document = JSON.parse(readFileSync(join(workBundle, 'review.json'), 'utf-8'))
    delete document.annotations[0].verdict
    delete document.annotations[1].suggestion
    writeFileSync(join(workBundle, 'review.json'), JSON.stringify(document))

    const result = validateBundle(workBundle)
    expect(result.valid).toBe(true)
    expect(result.diagnostics).toContainEqual({ kind: 'missing-verdict', annotationId: 'an-1' })
    expect(result.diagnostics).toContainEqual({ kind: 'missing-suggestion', annotationId: 'an-2', verdict: 'wrong' })

    rmSync(workBundle, { recursive: true, force: true })
  })

  it('does not check verdicts in a version 1 document', () => {
    const workBundle = mkdtempSync(join(tmpdir(), 'note-fields-'))
    cpSync(bundlePath('general-target'), workBundle, { recursive: true })
    const document = JSON.parse(readFileSync(join(workBundle, 'review.json'), 'utf-8'))
    document.schemaVersion = 1
    delete document.annotations[0].verdict
    delete document.annotations[1].suggestion
    writeFileSync(join(workBundle, 'review.json'), JSON.stringify(document))

    expect(validateBundle(workBundle).diagnostics).toEqual([])

    rmSync(workBundle, { recursive: true, force: true })
  })
})

describe('general Target', () => {
  it('resolves without a diagnostic', () => {
    const result = validateBundle(bundlePath('general-target'))
    expect(result.diagnostics).toEqual([])
    expect((result.document as { annotations: { target: unknown }[] }).annotations[0].target).toEqual({ type: 'general' })
  })
})

describe('Intent visuals', () => {
  it('produces no diagnostics when every visual image exists', () => {
    const result = validateBundle(bundlePath('visuals'))
    expect(result.valid).toBe(true)
    expect(result.diagnostics).toEqual([])
  })

  it.each(['assetPath', 'baseAssetPath'] as const)('flags a missing %s with a missing-asset Diagnostic', (field) => {
    const workBundle = mkdtempSync(join(tmpdir(), 'visuals-'))
    cpSync(bundlePath('visuals'), workBundle, { recursive: true })
    const document = JSON.parse(readFileSync(join(workBundle, 'review.json'), 'utf-8'))
    document.intent.visuals[1][field] = 'snapshot/nope.png'
    writeFileSync(join(workBundle, 'review.json'), JSON.stringify(document))

    const result = validateBundle(workBundle)
    expect(result.diagnostics).toContainEqual({ kind: 'missing-asset', assetPath: 'snapshot/nope.png' })

    rmSync(workBundle, { recursive: true, force: true })
  })

  it('flags a visual path that leaves assets/', () => {
    const workBundle = mkdtempSync(join(tmpdir(), 'visuals-'))
    cpSync(bundlePath('visuals'), workBundle, { recursive: true })
    const document = JSON.parse(readFileSync(join(workBundle, 'review.json'), 'utf-8'))
    document.intent.visuals[0].assetPath = '../review.json'
    writeFileSync(join(workBundle, 'review.json'), JSON.stringify(document))

    const result = validateBundle(workBundle)
    expect(result.diagnostics).toContainEqual({ kind: 'unsafe-asset-path', assetPath: '../review.json' })

    rmSync(workBundle, { recursive: true, force: true })
  })
})

describe('proof link', () => {
  it('produces no diagnostics for a proof with an existing code Target and image', () => {
    const result = validateBundle(bundlePath('proof-link'))
    expect(result.valid).toBe(true)
    expect(result.diagnostics).toEqual([])
  })

  it('flags a proof whose image is not in the patch', () => {
    const workBundle = mkdtempSync(join(tmpdir(), 'proof-'))
    cpSync(bundlePath('proof-link'), workBundle, { recursive: true })
    const document = JSON.parse(readFileSync(join(workBundle, 'review.json'), 'utf-8'))
    document.evidence[0].targetIds = ['an-1', 'assets/missing.png']
    writeFileSync(join(workBundle, 'review.json'), JSON.stringify(document))

    const result = validateBundle(workBundle)
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ kind: 'invalid-proof-link', evidenceId: 'ev-proof' }))

    rmSync(workBundle, { recursive: true, force: true })
  })
})

import type { ParsedPatch } from '../patch/types.ts'
import type { Annotation, CodeTarget, Evidence, ReviewDocument } from '../schema/types.ts'
import { ALLOWED_ASSET_EXTENSIONS } from '../security/asset-path.ts'
import type { Diagnostic } from './diagnostics.ts'

export interface ProofCodeRef {
  path: string
  hunkIndex?: number
  annotationId?: string
}

/** An Evidence item whose `targetIds` name a code Target and a changed image. */
export interface ProofLink {
  evidenceId: string
  imagePath: string
  code: ProofCodeRef
}

export interface ProofLinkResult {
  links: ProofLink[]
  diagnostics: Diagnostic[]
}

function isImagePath(id: string): boolean {
  const lowerId = id.toLowerCase()
  return ALLOWED_ASSET_EXTENSIONS.some((ext) => lowerId.endsWith(ext))
}

function hunkIndexOf(target: CodeTarget, patch: ParsedPatch): number | undefined {
  if (target.type === 'hunk') return target.hunkIndex
  if (target.type !== 'line') return undefined
  const file = patch.files.find((f) => f.path === target.path)
  const index = file?.hunks.findIndex((h) =>
    h.lines.some((l) => (target.side === 'base' ? l.oldLine === target.line : l.newLine === target.line)),
  )
  return index === undefined || index < 0 ? undefined : index
}

function codeRefFromAnnotation(annotation: Annotation, patch: ParsedPatch): ProofCodeRef | undefined {
  const { target } = annotation
  if (target.type === 'general' || target.type === 'binary') return undefined
  const hunkIndex = hunkIndexOf(target, patch)
  return { path: target.path, ...(hunkIndex === undefined ? {} : { hunkIndex }), annotationId: annotation.id }
}

function codeRefFromId(id: string, annotationsById: Map<string, Annotation>, patch: ParsedPatch): ProofCodeRef | undefined {
  const annotation = annotationsById.get(id)
  if (annotation) return codeRefFromAnnotation(annotation, patch)
  const file = patch.files.find((f) => f.path === id)
  return file && !file.binary ? { path: id } : undefined
}

function isIdOfImageSide(id: string, annotationsById: Map<string, Annotation>): boolean {
  const annotation = annotationsById.get(id)
  return annotation?.target.type === 'binary'
}

function findLinksForEvidence(evidence: Evidence, annotationsById: Map<string, Annotation>, patch: ParsedPatch): ProofLinkResult {
  const ids = evidence.targetIds ?? []
  const imageIds = ids.filter(isImagePath)
  const otherIds = ids.filter((id) => !isImagePath(id) && !isIdOfImageSide(id, annotationsById))
  if (imageIds.length === 0 || otherIds.length === 0) return { links: [], diagnostics: [] }

  if (!evidence.assetPath) {
    const detail = 'the evidence has no assetPath, so there is no image to show'
    return { links: [], diagnostics: [{ kind: 'invalid-proof-link', evidenceId: evidence.id, detail }] }
  }

  const diagnostics: Diagnostic[] = []
  const changedImagePaths = new Set(patch.files.filter((f) => f.binary).map((f) => f.path))
  const images = imageIds.filter((imagePath) => {
    const exists = changedImagePaths.has(imagePath)
    if (!exists) {
      diagnostics.push({ kind: 'invalid-proof-link', evidenceId: evidence.id, detail: `image ${imagePath} is not a changed image in the patch` })
    }
    return exists
  })

  const codeRefs = otherIds.flatMap((id) => codeRefFromId(id, annotationsById, patch) ?? [])
  if (codeRefs.length === 0) {
    const named = otherIds.join(', ')
    diagnostics.push({
      kind: 'invalid-proof-link',
      evidenceId: evidence.id,
      detail: `no code Target found for ${named} (use an Annotation id or a changed file path)`,
    })
  }

  const links = images.flatMap((imagePath) => codeRefs.map((code) => ({ evidenceId: evidence.id, imagePath, code })))
  return { links, diagnostics }
}

export function findProofLinks(document: ReviewDocument, patch: ParsedPatch): ProofLinkResult {
  const annotationsById = new Map((document.annotations ?? []).map((a) => [a.id, a]))
  const results = (document.evidence ?? []).map((e) => findLinksForEvidence(e, annotationsById, patch))
  return {
    links: results.flatMap((r) => r.links),
    diagnostics: results.flatMap((r) => r.diagnostics),
  }
}

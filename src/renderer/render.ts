import { resolve } from 'node:path'
import type { ReviewDocument, Target } from '../schema/types.ts'
import type { ParsedPatch, PatchFile } from '../patch/types.ts'
import type { Diagnostic } from '../bundle/diagnostics.ts'
import { collectCarriedReviewContent, createCaches, readChain } from '../bundle/carry-forward.ts'
import { ALLOWED_ASSET_EXTENSIONS } from '../security/asset-path.ts'
import type {
  RenderedFile,
  RenderedGroup,
  RenderedImageEvidence,
  RenderedLine,
  RenderedPipelineEvidence,
  RenderedSummary,
  SideBySideRow,
  ViewModel,
} from './types.ts'

/**
 * The app never launches a Generator itself (per framework.md) — this only
 * builds text for the Reviewer to copy and run themselves.
 */
export function buildGeneratorPrompt(bundlePath: string): string {
  return `Invoke the /review-workspace skill on this bundle: ${resolve(bundlePath)}`
}

/** Both layouts derive from the same RenderedLine[] — by construction they can never diverge in content. */
export function toInlineRows(lines: RenderedLine[]): RenderedLine[] {
  return lines
}

export function toSideBySideRows(lines: RenderedLine[]): SideBySideRow[] {
  const rows: SideBySideRow[] = []
  let i = 0
  while (i < lines.length) {
    if (lines[i].kind === 'context') {
      rows.push({ left: lines[i], right: lines[i] })
      i++
      continue
    }
    const removes: RenderedLine[] = []
    while (i < lines.length && lines[i].kind === 'remove') {
      removes.push(lines[i])
      i++
    }
    const adds: RenderedLine[] = []
    while (i < lines.length && lines[i].kind === 'add') {
      adds.push(lines[i])
      i++
    }
    const max = Math.max(removes.length, adds.length)
    for (let j = 0; j < max; j++) {
      rows.push({ left: removes[j] ?? null, right: adds[j] ?? null })
    }
  }
  return rows
}

const OVERFLOW_THRESHOLD = 120

function targetPath(target: Target): string {
  return target.path
}

function diagnosticPath(diagnostic: Diagnostic): string | undefined {
  return 'path' in diagnostic ? diagnostic.path : undefined
}

function diagnosticLine(diagnostic: Diagnostic): number | undefined {
  return diagnostic.kind === 'stale-line-target' ? diagnostic.line : undefined
}

function renderFile(patchFile: PatchFile, document: ReviewDocument, fileDiagnostics: Diagnostic[]): RenderedFile {
  const fileAnnotations = (document.annotations ?? []).filter((a) => targetPath(a.target) === patchFile.path)

  const hunks = patchFile.hunks.map((hunk, hunkIndex) => ({
    oldStart: hunk.oldStart,
    oldLines: hunk.oldLines,
    newStart: hunk.newStart,
    newLines: hunk.newLines,
    lines: hunk.lines.map((line, lineIndex): RenderedLine => {
      const lineAnnotations = fileAnnotations.filter(
        (a) =>
          a.target.type === 'line' &&
          ((a.target.side === 'base' && a.target.line === line.oldLine) ||
            (a.target.side === 'head' && a.target.line === line.newLine)),
      )
      const lineDiagnostics = fileDiagnostics.filter(
        (d) => diagnosticLine(d) !== undefined && (diagnosticLine(d) === line.oldLine || diagnosticLine(d) === line.newLine),
      )
      return {
        id: `${patchFile.path}#${hunkIndex}#${lineIndex}`,
        kind: line.kind,
        text: line.text,
        oldLine: line.oldLine,
        newLine: line.newLine,
        overflowsInline: line.text.length > OVERFLOW_THRESHOLD,
        annotations: lineAnnotations,
        diagnostics: lineDiagnostics,
      }
    }),
  }))

  const attachedLineDiagnosticKeys = new Set(hunks.flatMap((h) => h.lines.flatMap((l) => l.diagnostics)))
  const fileLevelDiagnostics = fileDiagnostics.filter((d) => !attachedLineDiagnosticKeys.has(d))

  const imageEvidence: RenderedImageEvidence[] = (document.evidence ?? [])
    .filter((e) => e.assetPath && ALLOWED_ASSET_EXTENSIONS.some((ext) => e.assetPath!.toLowerCase().endsWith(ext)))
    .filter((e) => (e.targetIds ?? []).includes(patchFile.path) || fileAnnotations.some((a) => (e.targetIds ?? []).includes(a.id)))
    .map((e) => ({
      id: e.id,
      assetPath: e.assetPath!,
      baseAssetPath: e.baseAssetPath,
      description: e.description,
      comparisonModes: e.baseAssetPath ? (['side-by-side', 'swipe', 'onion-skin', 'changed-pixel'] as const) : [],
    }))

  const pipelineEvidence: RenderedPipelineEvidence[] = (document.evidence ?? [])
    .filter((e) => e.pipeline)
    .filter((e) => (e.targetIds ?? []).includes(patchFile.path) || fileAnnotations.some((a) => (e.targetIds ?? []).includes(a.id)))
    .map((e) => ({
      id: e.id,
      jobName: e.pipeline!.jobName,
      status: e.pipeline!.status,
      url: e.pipeline!.url,
      logExcerpt: e.pipeline!.logExcerpt,
      description: e.description,
    }))

  return {
    path: patchFile.path,
    oldPath: patchFile.oldPath,
    binary: patchFile.binary,
    hunks,
    annotations: fileAnnotations,
    imageEvidence,
    pipelineEvidence,
    diagnostics: fileLevelDiagnostics,
  }
}

/**
 * Builds a deterministic, framework-agnostic view model from a validated bundle.
 * Ordering: files belonging to a Behavioral Group are ordered by that group's
 * declared `order`, then by the group's own target order; files not covered by
 * any group fall back to patch order, per framework.md's "missing optional
 * interpretation falls back to the complete patch in patch order" rule.
 * Dependency/risk ordering is deferred — the schema has no such fields yet to sort by.
 */
export function render(document: ReviewDocument, patch: ParsedPatch, diagnostics: Diagnostic[], bundlePath: string): ViewModel {
  const diagnosticsByPath = new Map<string, Diagnostic[]>()
  for (const d of diagnostics) {
    const path = diagnosticPath(d)
    if (!path) continue
    const list = diagnosticsByPath.get(path) ?? []
    list.push(d)
    diagnosticsByPath.set(path, list)
  }

  // Both `chain` below and `collectCarriedReviewContent` read the same chain.json —
  // sharing one `Caches` instance across both calls (scoped to this single `render()`
  // call, then discarded) makes that one disk read either way, without ever letting the
  // read survive past this call to go stale on a later one.
  const caches = createCaches()
  const chain = readChain(bundlePath, caches)

  // Behavioral Groups/Annotations from earlier rounds the incremental patch doesn't
  // touch surface here unchanged (framework.md's "slim rounds") — round N's own
  // document only needs fresh ones for genuinely new material.
  const carried = collectCarriedReviewContent(bundlePath, document, caches)
  const effectiveDocument: ReviewDocument = {
    ...document,
    behavioralGroups: [...(document.behavioralGroups ?? []), ...carried.behavioralGroups],
    annotations: [...(document.annotations ?? []), ...carried.annotations],
  }

  const groups: RenderedGroup[] = [...(effectiveDocument.behavioralGroups ?? [])]
    .sort((a, b) => a.order - b.order)
    .map((g) => ({
      id: g.id,
      title: g.title,
      description: g.description,
      order: g.order,
      risk: g.risk,
      filePaths: [...new Set((g.targets ?? []).map(targetPath))],
    }))

  const orderedPaths: string[] = []
  const seen = new Set<string>()
  for (const group of groups) {
    for (const path of group.filePaths) {
      if (!seen.has(path)) {
        seen.add(path)
        orderedPaths.push(path)
      }
    }
  }
  for (const patchFile of patch.files) {
    if (!seen.has(patchFile.path)) {
      seen.add(patchFile.path)
      orderedPaths.push(patchFile.path)
    }
  }

  const patchFileByPath = new Map(patch.files.map((f) => [f.path, f]))
  const files: RenderedFile[] = orderedPaths
    .map((path) => patchFileByPath.get(path))
    .filter((f): f is PatchFile => f !== undefined)
    .map((f) => renderFile(f, effectiveDocument, diagnosticsByPath.get(f.path) ?? []))

  const attachedPaths = new Set(patch.files.map((f) => f.path))
  const bundleLevelDiagnostics = diagnostics.filter((d) => {
    const path = diagnosticPath(d)
    return !path || !attachedPaths.has(path)
  })

  return {
    comparison: document.comparison,
    round: chain?.round ?? 1,
    groups,
    files,
    diagnostics: bundleLevelDiagnostics,
    generatorPrompt: buildGeneratorPrompt(bundlePath),
    answers: document.answers ?? [],
    summary: renderSummary(effectiveDocument, attachedPaths),
  }
}

/** Dangling ids/paths are dropped rather than diagnosed — same treatment as evidence/verification targetIds. */
function renderSummary(document: ReviewDocument, attachedPaths: Set<string>): RenderedSummary | undefined {
  if (!document.summary) return undefined
  const annotationsById = new Map((document.annotations ?? []).map((a) => [a.id, a]))
  return {
    text: document.summary.text,
    highlightAnnotations: (document.summary.highlightAnnotationIds ?? [])
      .map((id) => annotationsById.get(id))
      .filter((a): a is NonNullable<typeof a> => a !== undefined),
    highlightPaths: (document.summary.highlightPaths ?? []).filter((path) => attachedPaths.has(path)),
  }
}

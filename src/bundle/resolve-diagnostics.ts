import { existsSync, statSync } from 'node:fs'
import { validateReviewDocumentSchema } from '../schema/validate.ts'
import type { ReviewDocument, Target } from '../schema/types.ts'
import type { ParsedPatch, PatchFile } from '../patch/types.ts'
import type { Diagnostic } from './diagnostics.ts'
import { resolveAssetPath } from '../security/asset-path.ts'
import { DEFAULT_LIMITS, type BundleLimits } from '../security/limits.ts'
import { readQuestions } from '../questions/questions-log.ts'

function findFile(patch: ParsedPatch, path: string): PatchFile | undefined {
  return patch.files.find((f) => f.path === path)
}

function checkAssetPath(bundlePath: string, assetPath: string, limits: BundleLimits): Diagnostic | undefined {
  const resolution = resolveAssetPath(bundlePath, assetPath)
  if (!resolution.ok) {
    return resolution.reason === 'unsafe-path'
      ? { kind: 'unsafe-asset-path', assetPath }
      : { kind: 'disallowed-asset-type', assetPath }
  }
  if (!existsSync(resolution.absolutePath)) {
    return { kind: 'missing-asset', assetPath }
  }
  const { size } = statSync(resolution.absolutePath)
  if (size > limits.maxAssetBytes) {
    return { kind: 'asset-too-large', assetPath, bytes: size }
  }
  return undefined
}

/** Resolves a Target against a patch, returning the Diagnostic that explains why it's unresolved/stale, or undefined when it resolves cleanly. */
export function resolveTarget(target: Target, patch: ParsedPatch): Diagnostic | undefined {
  const file = findFile(patch, target.path)

  if (target.type === 'file') {
    if (!file) return { kind: 'unresolved-target', targetType: 'file', path: target.path, detail: 'file not found in patch' }
    return undefined
  }

  if (target.type === 'binary') {
    if (!file || !file.binary) {
      return { kind: 'unresolved-target', targetType: 'binary', path: target.path, detail: 'no binary change found for file' }
    }
    return undefined
  }

  if (target.type === 'hunk') {
    if (!file || !file.hunks[target.hunkIndex]) {
      return { kind: 'unresolved-target', targetType: 'hunk', path: target.path, detail: `hunk index ${target.hunkIndex} not found` }
    }
    return undefined
  }

  // target.type === 'line'
  const line = file?.hunks
    .flatMap((h) => h.lines)
    .find((l) => (target.side === 'base' ? l.oldLine === target.line : l.newLine === target.line))

  if (!line) {
    return {
      kind: 'stale-line-target',
      path: target.path,
      side: target.side,
      line: target.line,
      expectedText: target.expectedText,
      detail: 'no line found at that position',
    }
  }
  if (line.text !== target.expectedText) {
    return {
      kind: 'stale-line-target',
      path: target.path,
      side: target.side,
      line: target.line,
      expectedText: target.expectedText,
      detail: `expected ${JSON.stringify(target.expectedText)}, found ${JSON.stringify(line.text)}`,
    }
  }
  return undefined
}

export function collectDiagnostics(
  document: ReviewDocument,
  patch: ParsedPatch,
  bundlePath: string,
  limits: BundleLimits = DEFAULT_LIMITS,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = []

  const schemaResult = validateReviewDocumentSchema(document)
  if (!schemaResult.valid) {
    for (const err of schemaResult.errors ?? []) {
      diagnostics.push({ kind: 'invalid-field', instancePath: err.instancePath, message: err.message ?? 'invalid field' })
    }
  }

  for (const group of document.behavioralGroups ?? []) {
    for (const target of group.targets ?? []) {
      const diagnostic = resolveTarget(target, patch)
      if (diagnostic) diagnostics.push(diagnostic)
    }
  }

  for (const annotation of document.annotations ?? []) {
    const diagnostic = resolveTarget(annotation.target, patch)
    if (diagnostic) diagnostics.push(diagnostic)
    for (const related of annotation.relatedTargets ?? []) {
      const relatedDiagnostic = resolveTarget(related.target, patch)
      if (relatedDiagnostic) diagnostics.push(relatedDiagnostic)
    }
  }

  for (const evidence of document.evidence ?? []) {
    for (const assetPath of [evidence.assetPath, evidence.baseAssetPath]) {
      if (!assetPath) continue
      const diagnostic = checkAssetPath(bundlePath, assetPath, limits)
      if (diagnostic) diagnostics.push(diagnostic)
    }
  }

  if (document.answers?.length) {
    const questionIds = new Set(readQuestions(bundlePath).map((q) => q.id))
    for (const answer of document.answers) {
      if (!questionIds.has(answer.questionId)) {
        diagnostics.push({ kind: 'dangling-answer', answerId: answer.id, questionId: answer.questionId })
      }
    }
  }

  return diagnostics
}

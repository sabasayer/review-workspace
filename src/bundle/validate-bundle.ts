import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parsePatch } from '../patch/parse.ts'
import { PatchParseError, type ParsedPatch } from '../patch/types.ts'
import { collectDiagnostics } from './resolve-diagnostics.ts'
import type { Diagnostic } from './diagnostics.ts'
import type { ReviewDocument } from '../schema/types.ts'
import { DEFAULT_LIMITS, type BundleLimits } from '../security/limits.ts'

export const SUPPORTED_SCHEMA_VERSIONS = [1]

export type BlockingReason =
  | 'unparseable-json'
  | 'unsupported-schema-version'
  | 'missing-comparison-identity'
  | 'unusable-patch'
  | 'document-too-large'
  | 'patch-too-large'
  | 'too-many-patch-lines'

export interface ValidateBundleResult {
  valid: boolean
  document?: unknown
  patch?: ParsedPatch
  diagnostics?: Diagnostic[]
  blockingReason?: BlockingReason
  message?: string
}

function hasComparisonIdentity(document: unknown): boolean {
  if (typeof document !== 'object' || document === null) return false
  const comparison = (document as Record<string, unknown>).comparison
  if (typeof comparison !== 'object' || comparison === null) return false
  const { base, head } = comparison as Record<string, unknown>
  return typeof base === 'string' && base.length > 0 && typeof head === 'string' && head.length > 0
}

export function validateBundle(
  bundlePath: string,
  limits: BundleLimits = DEFAULT_LIMITS,
  documentFileName = 'review.json',
): ValidateBundleResult {
  let raw: string
  try {
    raw = readFileSync(join(bundlePath, documentFileName), 'utf-8')
  } catch (err) {
    return { valid: false, blockingReason: 'unparseable-json', message: (err as Error).message }
  }

  if (Buffer.byteLength(raw, 'utf-8') > limits.maxDocumentBytes) {
    return {
      valid: false,
      blockingReason: 'document-too-large',
      message: `${documentFileName} exceeds ${limits.maxDocumentBytes} bytes`,
    }
  }

  let document: unknown
  try {
    document = JSON.parse(raw)
  } catch (err) {
    return { valid: false, blockingReason: 'unparseable-json', message: (err as Error).message }
  }

  const schemaVersion = (document as Record<string, unknown> | null)?.schemaVersion
  if (typeof schemaVersion !== 'number' || !SUPPORTED_SCHEMA_VERSIONS.includes(schemaVersion)) {
    return {
      valid: false,
      blockingReason: 'unsupported-schema-version',
      message: `schemaVersion ${String(schemaVersion)} is not supported (supported: ${SUPPORTED_SCHEMA_VERSIONS.join(', ')})`,
    }
  }

  if (!hasComparisonIdentity(document)) {
    return { valid: false, blockingReason: 'missing-comparison-identity', message: 'comparison.base/head are required' }
  }

  let rawPatch: string
  try {
    rawPatch = readFileSync(join(bundlePath, 'changes.diff'), 'utf-8')
  } catch (err) {
    return { valid: false, blockingReason: 'unusable-patch', message: (err as Error).message }
  }

  if (Buffer.byteLength(rawPatch, 'utf-8') > limits.maxPatchBytes) {
    return { valid: false, blockingReason: 'patch-too-large', message: `changes.diff exceeds ${limits.maxPatchBytes} bytes` }
  }

  let patch: ParsedPatch
  try {
    patch = parsePatch(rawPatch)
  } catch (err) {
    const message = err instanceof PatchParseError || err instanceof Error ? err.message : String(err)
    return { valid: false, blockingReason: 'unusable-patch', message }
  }

  const totalLines = patch.files.reduce((sum, f) => sum + f.hunks.reduce((s, h) => s + h.lines.length, 0), 0)
  if (totalLines > limits.maxPatchLines) {
    return {
      valid: false,
      blockingReason: 'too-many-patch-lines',
      message: `patch has ${totalLines} lines, exceeding the limit of ${limits.maxPatchLines}`,
    }
  }

  const diagnostics = collectDiagnostics(document as ReviewDocument, patch, bundlePath, limits)
  return { valid: true, document, patch, diagnostics }
}

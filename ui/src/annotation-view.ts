import type { Annotation, RenderedAnnotationVerification, RenderedGroup } from './types.ts'

/**
 * Splits an Annotation/Group's free text into a scannable headline (shown at
 * rest) and the rest of the judgment prose (shown on expand). This is a
 * client-side heuristic — the schema has no dedicated `headline` field, so it
 * guesses at the first sentence/clause boundary. It won't always cut cleanly;
 * the durable fix is a Generator-written `headline` field, not a smarter regex
 * here. Revisit if guessed splits routinely land in the wrong place.
 */
export function splitHeadline(text: string): { headline: string; body: string } {
  const periodIdx = text.indexOf('. ')
  const dashIdx = text.indexOf(' — ')
  const candidates = [periodIdx, dashIdx].filter((i) => i >= 0)
  if (!candidates.length) return { headline: text, body: '' }
  const cut = Math.min(...candidates)
  const isDash = cut === dashIdx
  return {
    headline: text.slice(0, cut + (isDash ? 0 : 1)).trim(),
    body: text.slice(cut + (isDash ? 3 : 2)).trim(),
  }
}

export interface VerificationCounts {
  verified: number
  unverified: number
  gap: number
}

export interface VerificationEntry {
  verification: RenderedAnnotationVerification
  /** Only set when some Annotation on this file also carries this same Verification id — a Verification item commonly targets a file/Evidence directly with no specific Annotation at all. */
  annotationId?: string
  path: string
}

/**
 * Flattens every File's own Verification list (which already covers items
 * reachable via a file path OR any of its Annotations, see RenderedFile.verification)
 * into one list, deduped by Verification id — the same item commonly targets
 * more than one file (e.g. a source file and the snapshot it fixed), and
 * without deduping here it would be double-counted everywhere this feeds into
 * (the bundle only has one such check, not two). First file encountered wins
 * the entry's path/annotationId.
 */
export function collectVerificationEntries(
  files: readonly { path: string; annotations: readonly Annotation[]; verification: readonly RenderedAnnotationVerification[] }[],
): VerificationEntry[] {
  const byId = new Map<string, VerificationEntry>()
  for (const f of files) {
    for (const v of f.verification) {
      if (byId.has(v.id)) continue
      byId.set(v.id, { verification: v, annotationId: f.annotations.find((a) => a.verification.some((av) => av.id === v.id))?.id, path: f.path })
    }
  }
  return [...byId.values()]
}

export function countVerification(files: readonly { verification: readonly RenderedAnnotationVerification[] }[]): VerificationCounts {
  const seen = new Map<string, RenderedAnnotationVerification>()
  for (const f of files) for (const v of f.verification) seen.set(v.id, v)
  const counts: VerificationCounts = { verified: 0, unverified: 0, gap: 0 }
  for (const v of seen.values()) counts[v.status]++
  return counts
}

const riskWeight: Record<string, number> = { high: 0, medium: 1, low: 2 }

export function groupRiskLookup(groups: readonly RenderedGroup[]): (path: string) => string | undefined {
  const riskByFile = new Map(groups.flatMap((g) => g.filePaths.map((p) => [p, g.risk] as const)))
  return (path: string) => riskByFile.get(path)
}

/** Anything not yet `verified`, ordered by the risk of the file it concerns — the "what to look at first" ranking, built only from real Verification data. */
export function startHere(entries: readonly VerificationEntry[], riskOfPath: (path: string) => string | undefined): VerificationEntry[] {
  return entries
    .filter((e) => e.verification.status !== 'verified')
    .sort((a, b) => (riskWeight[riskOfPath(a.path) ?? 'low'] ?? 3) - (riskWeight[riskOfPath(b.path) ?? 'low'] ?? 3))
}

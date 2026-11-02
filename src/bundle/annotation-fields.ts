import type { ReviewDocument } from '../schema/types.ts'
import type { Diagnostic } from './diagnostics.ts'

const FIRST_VERSION_REQUIRING_NOTE_FIELDS = 2
const VERDICTS_NEEDING_SUGGESTION = ['wrong', 'missing']

export function checkAnnotationFields(document: ReviewDocument): Diagnostic[] {
  if (document.schemaVersion < FIRST_VERSION_REQUIRING_NOTE_FIELDS) return []

  const diagnostics: Diagnostic[] = []
  for (const annotation of document.annotations ?? []) {
    if (!annotation.verdict) {
      diagnostics.push({ kind: 'missing-verdict', annotationId: annotation.id })
      continue
    }
    const needsSuggestion = VERDICTS_NEEDING_SUGGESTION.includes(annotation.verdict)
    if (needsSuggestion && !annotation.suggestion?.trim()) {
      diagnostics.push({ kind: 'missing-suggestion', annotationId: annotation.id, verdict: annotation.verdict as 'wrong' | 'missing' })
    }
  }
  return diagnostics
}

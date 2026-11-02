import type { Annotation, CommentKind, Target } from './types.ts'

export function changeRequestDraft(annotation: Pick<Annotation, 'suggestion'>): string {
  return annotation.suggestion ?? ''
}

export function draftRows(kind: CommentKind): number {
  return kind === 'change-request' ? 6 : 3
}

export function questionDraft(target: Target, headline: string | undefined): string {
  return target.type === 'general' && headline ? `About "${headline}": ` : ''
}

import type { GeneralAnnotation } from './types.ts'
import type { VerificationEntry } from './annotation-view.ts'

export type StartHereItem =
  | { kind: 'general'; annotation: GeneralAnnotation }
  | { kind: 'verification'; entry: VerificationEntry }

export function openGeneralFindings(annotations: readonly GeneralAnnotation[]): GeneralAnnotation[] {
  return annotations.filter((a) => a.verdict !== 'intended')
}

export function buildStartHereItems(
  generalAnnotations: readonly GeneralAnnotation[],
  entries: readonly VerificationEntry[],
): StartHereItem[] {
  return [
    ...openGeneralFindings(generalAnnotations).map((annotation): StartHereItem => ({ kind: 'general', annotation })),
    ...entries.map((entry): StartHereItem => ({ kind: 'verification', entry })),
  ]
}

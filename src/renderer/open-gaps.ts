import type { Annotation } from '../schema/types.ts'

interface FileWithVerification {
  verification: readonly { id: string; status: 'unverified' | 'verified' | 'gap' }[]
}

export function isOpenGapAnnotation(annotation: Annotation): boolean {
  return annotation.verdict !== 'intended'
}

export function countOpenGaps(files: readonly FileWithVerification[], generalAnnotations: readonly Annotation[]): number {
  const gapIds = new Set<string>()
  for (const file of files) {
    for (const item of file.verification) {
      if (item.status === 'gap') gapIds.add(item.id)
    }
  }
  return gapIds.size + generalAnnotations.filter(isOpenGapAnnotation).length
}

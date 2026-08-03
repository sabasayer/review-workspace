import type { Annotation, RenderedFile } from './types.ts'

export interface LineAnnotationEntry {
  annotation: Annotation
  hunkIndex: number
  lineId: string
}

export function fileLevelAnnotations(file: RenderedFile): Annotation[] {
  return file.annotations.filter((a) => a.target.type !== 'line')
}

export function lineLevelAnnotations(file: RenderedFile): LineAnnotationEntry[] {
  const entries: LineAnnotationEntry[] = []
  file.hunks.forEach((hunk, hunkIndex) => {
    for (const line of hunk.lines) {
      for (const annotation of line.annotations) entries.push({ annotation, hunkIndex, lineId: line.id })
    }
  })
  return entries
}

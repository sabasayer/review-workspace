import type { GroupBucket } from './grouped-files.ts'

export function buildAnnotationNumbers(buckets: GroupBucket[]): Map<string, number> {
  const numbers = new Map<string, number>()
  let next = 1
  for (const bucket of buckets) {
    for (const file of bucket.files) {
      for (const a of file.annotations) {
        if (a.target.type !== 'line') numbers.set(a.id, next++)
      }
      for (const hunk of file.hunks) {
        for (const line of hunk.lines) {
          for (const a of line.annotations) numbers.set(a.id, next++)
        }
      }
    }
  }
  return numbers
}

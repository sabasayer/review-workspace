import type { RenderedFile, RenderedGroup } from './types.ts'

export interface GroupBucket {
  group: RenderedGroup | null
  filePaths: string[]
  files: RenderedFile[]
}

export function groupFilesByBehavioralGroup(files: RenderedFile[], groups: RenderedGroup[]): GroupBucket[] {
  const assigned = new Set<string>()
  const buckets: GroupBucket[] = groups.map((group) => {
    const matched = group.filePaths.map((p) => files.find((f) => f.path === p)).filter((f): f is RenderedFile => !!f)
    matched.forEach((f) => assigned.add(f.path))
    return { group, filePaths: matched.map((f) => f.path), files: matched }
  })
  const rest = files.filter((f) => !assigned.has(f.path))
  if (rest.length) buckets.push({ group: null, filePaths: rest.map((f) => f.path), files: rest })
  return buckets
}

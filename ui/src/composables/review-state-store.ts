import { reactive, readonly } from 'vue'
import { getWriteToken } from './questions-store.ts'

// Keeps every field `/state` returns, not just the ones below — this store
// only manages reviewedFiles/resolvedNotes but PUTs the whole object back, so
// unrelated fields (groups, notes, decision) round-trip untouched.
interface ReviewState {
  reviewedFiles?: string[]
  resolvedNotes?: string[]
  [key: string]: unknown
}

const state = reactive({ data: {} as ReviewState })

export async function loadReviewState(): Promise<void> {
  const res = await fetch('/state')
  state.data = res.ok ? await res.json() : {}
}

async function persist(): Promise<void> {
  await fetch('/state', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'x-write-token': getWriteToken() },
    body: JSON.stringify(state.data),
  })
}

function toggle(field: 'reviewedFiles' | 'resolvedNotes', id: string): void {
  const set = new Set(state.data[field] ?? [])
  set.has(id) ? set.delete(id) : set.add(id)
  state.data[field] = [...set]
  void persist()
}

export function isFileReviewed(path: string): boolean {
  return state.data.reviewedFiles?.includes(path) ?? false
}

export function toggleFileReviewed(path: string): void {
  toggle('reviewedFiles', path)
}

export function isNoteResolved(annotationId: string): boolean {
  return state.data.resolvedNotes?.includes(annotationId) ?? false
}

export function toggleNoteResolved(annotationId: string): void {
  toggle('resolvedNotes', annotationId)
}

export function useReviewState() {
  return readonly(state)
}

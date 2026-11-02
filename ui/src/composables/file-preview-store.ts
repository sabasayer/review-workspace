import { reactive } from 'vue'
import { fetchRepoFile } from '../api.ts'
import { diffGlimpse, resolveFileRef } from '../file-refs.ts'
import type { AnchorBox } from '../file-preview-position.ts'
import type { RenderedLine } from '../types.ts'
import { currentFiles } from './view-model-store.ts'

export const REPO_PREVIEW_LINES = 40

export type PreviewBody =
  | { kind: 'diff'; path: string; lines: RenderedLine[] }
  | { kind: 'repo'; path: string; lines: string[]; truncated: boolean }

interface PreviewState {
  body: PreviewBody | null
  anchor: AnchorBox | null
}

export const previewState = reactive<PreviewState>({ body: null, anchor: null })

const repoCache = new Map<string, Promise<{ lines: string[]; truncated: boolean } | null>>()
let openRequest = 0

function loadRepoTop(path: string) {
  let cached = repoCache.get(path)
  if (!cached) {
    cached = fetchRepoFile(path, REPO_PREVIEW_LINES)
      .then((file) => (file ? { lines: file.content.split('\n'), truncated: file.truncated } : null))
      .catch(() => null)
    repoCache.set(path, cached)
  }
  return cached
}

export function resetPreviewCache(): void {
  repoCache.clear()
}

export function closePreview(): void {
  openRequest++
  previewState.body = null
  previewState.anchor = null
}

export async function openPreview(name: string, anchor: AnchorBox): Promise<void> {
  const request = ++openRequest
  const ref = resolveFileRef(name, currentFiles.value.map((f) => f.path))
  if (ref.kind === 'ambiguous') return closePreview()

  if (ref.kind === 'diff') {
    const file = currentFiles.value.find((f) => f.path === ref.path)
    if (!file) return closePreview()
    previewState.body = { kind: 'diff', path: ref.path, lines: diffGlimpse(file) }
    previewState.anchor = anchor
    return
  }

  const top = await loadRepoTop(ref.path)
  if (request !== openRequest) return
  if (!top) return closePreview()
  previewState.body = { kind: 'repo', path: ref.path, ...top }
  previewState.anchor = anchor
}

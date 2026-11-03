import type { LiveHeadStatus, ViewModel, WatcherRead } from './types.ts'

export function assetUrl(path: string): string {
  return `/api/assets/${path.split('/').map(encodeURIComponent).join('/')}`
}

export async function fetchView(): Promise<ViewModel> {
  const res = await fetch('/api/view')
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const backup = body.backupPath ? `. Backup: ${body.backupPath}` : ''
    throw new Error(`GET /view failed (${res.status}): ${body.error ?? res.statusText}${backup}`)
  }
  return res.json()
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`GET ${path} failed (${res.status})`)
  return res.json()
}

export function fetchLiveHead(): Promise<LiveHeadStatus> {
  return fetchJson('/api/live-head')
}

export function fetchWatcher(): Promise<WatcherRead> {
  return fetchJson('/api/watcher')
}

export interface RepoFileTop {
  path: string
  content: string
  truncated: boolean
}

export async function fetchRepoFile(path: string, lines: number): Promise<RepoFileTop | null> {
  const res = await fetch(`/api/repo-file?path=${encodeURIComponent(path)}&lines=${lines}`)
  return res.ok ? res.json() : null
}

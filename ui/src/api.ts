import type { ViewModel } from './types.ts'

export function assetUrl(path: string): string {
  return `/api/assets/${path.split('/').map(encodeURIComponent).join('/')}`
}

export async function fetchView(): Promise<ViewModel> {
  const res = await fetch('/api/view')
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(`GET /view failed (${res.status}): ${body.error ?? res.statusText}`)
  }
  return res.json()
}

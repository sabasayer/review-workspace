import { afterEach, describe, expect, it, vi } from 'vitest'
import { assetUrl, fetchLiveHead, fetchWatcher } from './api.ts'

describe('assetUrl', () => {
  it('prefixes the API assets route', () => {
    expect(assetUrl('snapshot/head.png')).toBe('/api/assets/snapshot/head.png')
  })

  it('encodes path segments', () => {
    expect(assetUrl('uploads/hash/file name.png')).toBe('/api/assets/uploads/hash/file%20name.png')
  })
})

describe('status fetchers', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('reads live-head and watcher from the API', async () => {
    const fetchMock = vi.fn(async (path: string) => ({ ok: true, json: async () => ({ path }) }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await fetchLiveHead()).toEqual({ path: '/api/live-head' })
    expect(await fetchWatcher()).toEqual({ path: '/api/watcher' })
  })

  it('throws when the API fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })))
    await expect(fetchWatcher()).rejects.toThrow('GET /api/watcher failed (500)')
  })
})

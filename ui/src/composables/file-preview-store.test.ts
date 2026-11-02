import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RenderedFile } from '../types.ts'

vi.mock('../api.ts', () => ({ fetchRepoFile: vi.fn() }))

import { fetchRepoFile } from '../api.ts'
import { closePreview, openPreview, previewState, resetPreviewCache } from './file-preview-store.ts'
import { currentFiles } from './view-model-store.ts'

const mockedFetch = vi.mocked(fetchRepoFile)
const box = { left: 1, top: 2, bottom: 3 }
const line = (n: number) => ({ id: `f#0#${n}`, kind: 'add', text: `l${n}`, newLine: n })

beforeEach(() => {
  closePreview()
  resetPreviewCache()
  mockedFetch.mockReset()
  currentFiles.value = [
    { path: 'utils/repos.ts', binary: false, hunks: [{ lines: [1, 2, 3].map(line) }] },
    { path: 'a/index.ts', binary: false, hunks: [] },
    { path: 'b/index.ts', binary: false, hunks: [] },
  ] as unknown as RenderedFile[]
})

describe('file preview store', () => {
  it('shows a diff glimpse for a changed file without calling the server', async () => {
    await openPreview('repos.ts', box)
    expect(previewState.body).toMatchObject({ kind: 'diff', path: 'utils/repos.ts' })
    expect(previewState.anchor).toEqual(box)
    expect(mockedFetch).not.toHaveBeenCalled()
  })

  it('shows the top of a file outside the diff', async () => {
    mockedFetch.mockResolvedValue({ path: 'nuxt.config.ts', content: 'a\nb', truncated: true })
    await openPreview('nuxt.config.ts', box)
    expect(mockedFetch).toHaveBeenCalledWith('nuxt.config.ts', 40)
    expect(previewState.body).toEqual({ kind: 'repo', path: 'nuxt.config.ts', lines: ['a', 'b'], truncated: true })
  })

  it('shows nothing when the file cannot be read', async () => {
    mockedFetch.mockResolvedValue(null)
    await openPreview('missing.ts', box)
    expect(previewState.body).toBeNull()
  })

  it('shows nothing when the request fails', async () => {
    mockedFetch.mockRejectedValue(new Error('offline'))
    await openPreview('missing.ts', box)
    expect(previewState.body).toBeNull()
  })

  it('shows nothing for an ambiguous name', async () => {
    await openPreview('index.ts', box)
    expect(previewState.body).toBeNull()
  })

  it('reads a file from the server only once', async () => {
    mockedFetch.mockResolvedValue({ path: 'x.ts', content: 'x', truncated: false })
    await openPreview('x.ts', box)
    await openPreview('x.ts', box)
    expect(mockedFetch).toHaveBeenCalledTimes(1)
  })

  it('drops a late answer after the preview was closed', async () => {
    let resolveFetch!: (value: { path: string; content: string; truncated: boolean }) => void
    mockedFetch.mockReturnValue(new Promise((resolve) => (resolveFetch = resolve)))
    const pending = openPreview('slow.ts', box)
    closePreview()
    resolveFetch({ path: 'slow.ts', content: 'late', truncated: false })
    await pending
    expect(previewState.body).toBeNull()
  })

  it('closes', async () => {
    await openPreview('repos.ts', box)
    closePreview()
    expect(previewState.body).toBeNull()
    expect(previewState.anchor).toBeNull()
  })

  it('closes an open preview when the next name cannot be previewed', async () => {
    await openPreview('repos.ts', box)
    mockedFetch.mockResolvedValue(null)
    await openPreview('ghost.ts', box)
    expect(previewState.body).toBeNull()
    await openPreview('repos.ts', box)
    await openPreview('index.ts', box)
    expect(previewState.body).toBeNull()
  })
})

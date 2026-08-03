import { describe, expect, it } from 'vitest'
import { expandHunk, isHunkExpanded } from './expanded-hunks-store.ts'

describe('expanded-hunks-store', () => {
  it('starts collapsed', () => {
    expect(isHunkExpanded('src/auth/login.ts', 0)).toBe(false)
  })

  it('tracks expanded hunks by path and index', () => {
    expandHunk('src/auth/login.ts', 0)
    expect(isHunkExpanded('src/auth/login.ts', 0)).toBe(true)
    expect(isHunkExpanded('src/auth/login.ts', 1)).toBe(false)
  })
})

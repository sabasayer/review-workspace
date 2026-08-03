import { describe, expect, it } from 'vitest'
import { isFileCollapsed, toggleFile } from './expanded-files-store.ts'

describe('expanded-files-store', () => {
  it('uses the default collapsed state until toggled', () => {
    expect(isFileCollapsed('src/untouched-a.ts', true)).toBe(true)
    expect(isFileCollapsed('src/untouched-b.ts', false)).toBe(false)
  })

  it('remembers an explicit override', () => {
    toggleFile('src/auth/login.ts', true)
    expect(isFileCollapsed('src/auth/login.ts', true)).toBe(false)
    toggleFile('src/auth/login.ts', false)
    expect(isFileCollapsed('src/auth/login.ts', false)).toBe(true)
  })
})

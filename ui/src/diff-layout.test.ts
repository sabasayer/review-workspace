import { describe, expect, it } from 'vitest'
import { anchorId, lineAnchorId, toSideBySideRows } from './diff-layout.ts'
import type { RenderedLine } from './types.ts'

function line(id: string, kind: RenderedLine['kind'], text = 'x'): RenderedLine {
  return { id, kind, text, overflowsInline: false, annotations: [], diagnostics: [] }
}

describe('anchorId', () => {
  it('sanitizes path separators for DOM ids', () => {
    expect(anchorId('src/auth/login.ts')).toBe('file-src-auth-login-ts')
  })
})

describe('lineAnchorId', () => {
  it('sanitizes line ids that contain hash separators', () => {
    expect(lineAnchorId('src/auth/login.ts#0#2')).toBe('line-src-auth-login-ts-0-2')
  })
})

describe('toSideBySideRows', () => {
  it('pairs context lines on both sides', () => {
    const rows = toSideBySideRows([line('a', 'context', 'ctx')])
    expect(rows).toEqual([{ left: expect.objectContaining({ id: 'a' }), right: expect.objectContaining({ id: 'a' }) }])
  })

  it('aligns removes and adds in order', () => {
    const rows = toSideBySideRows([
      line('r1', 'remove', '-old'),
      line('a1', 'add', '+new'),
      line('r2', 'remove', '-gone'),
    ])
    expect(rows).toEqual([
      { left: expect.objectContaining({ id: 'r1' }), right: expect.objectContaining({ id: 'a1' }) },
      { left: expect.objectContaining({ id: 'r2' }), right: null },
    ])
  })
})

import { describe, expect, it } from 'vitest'
import { highlightCode } from './highlight.ts'

describe('highlightCode', () => {
  it('escapes HTML in source', () => {
    expect(highlightCode('a < b && c > d')).toContain('&lt;')
    expect(highlightCode('a < b && c > d')).not.toContain('< b')
  })

  it('wraps keywords in a span class', () => {
    const html = highlightCode('const value = 1')
    expect(html).toContain('class="')
    expect(html).toContain('const')
  })

  it('wraps string literals', () => {
    const html = highlightCode('return "hello"')
    expect(html).toMatch(/hello/)
    expect(html).toContain('span')
  })
})

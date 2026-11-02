import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { contrastRatio, mixOver, parseHex } from './contrast.ts'

const css = readFileSync(join(import.meta.dirname, 'main.css'), 'utf-8')

function token(theme: ':root' | '.dark', name: string): string {
  const block = css.split(`${theme} {`)[1].split('}')[0]
  const match = new RegExp(`${name}: (#[0-9a-f]{6})`).exec(block)
  if (!match) throw new Error(`Missing ${name} in ${theme}`)
  return match[1]
}

describe('contrastRatio', () => {
  it('is 21 for black on white and 1 for equal colours', () => {
    expect(contrastRatio(parseHex('#000000'), parseHex('#ffffff'))).toBeCloseTo(21, 5)
    expect(contrastRatio(parseHex('#777777'), parseHex('#777777'))).toBe(1)
  })

  it('does not depend on the argument order', () => {
    const a = parseHex('#087f5b')
    const b = parseHex('#ffffff')
    expect(contrastRatio(a, b)).toBe(contrastRatio(b, a))
  })
})

describe('mixOver', () => {
  it('blends a colour over a background by alpha', () => {
    expect(mixOver(parseHex('#000000'), parseHex('#ffffff'), 0.5)).toEqual([128, 128, 128])
  })
})

describe.each([':root', '.dark'] as const)('Resolved checkbox and divider in %s theme', (theme) => {
  const control = parseHex(token(theme, '--ui-border-control'))
  const noteTint = theme === ':root' ? '#9a6200' : '#f0bd68'
  const surfaces = {
    page: parseHex(token(theme, '--ui-bg')),
    card: parseHex(token(theme, '--ui-bg-elevated')),
    note: mixOver(parseHex(noteTint), parseHex(token(theme, '--ui-bg')), 0.05),
  }

  it.each(Object.entries(surfaces))('border has at least 3:1 on the %s surface', (_name, surface) => {
    expect(contrastRatio(control, surface)).toBeGreaterThanOrEqual(3)
  })

  it('label text has at least 4.5:1 on the note surface', () => {
    expect(contrastRatio(parseHex(token(theme, '--ui-text')), surfaces.note)).toBeGreaterThanOrEqual(4.5)
  })

  it('checked box (primary) has at least 3:1 on the note surface', () => {
    expect(contrastRatio(parseHex(token(theme, '--ui-primary')), surfaces.note)).toBeGreaterThanOrEqual(3)
  })
})

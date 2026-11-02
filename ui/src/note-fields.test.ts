import { describe, expect, it } from 'vitest'
import { lineLabel, severityColor, severityLabel, sourceLabel, verdictColor, verdictLabel } from './note-fields.ts'

describe('note fields', () => {
  it('labels and colours each verdict', () => {
    expect(verdictLabel('wrong')).toBe('Wrong')
    expect(verdictColor('wrong')).toBe('error')
    expect(verdictColor('intended')).toBe('success')
    expect(verdictColor('missing')).toBe('warning')
    expect(verdictColor('unclear')).toBe('neutral')
  })

  it('labels and colours severity', () => {
    expect(severityLabel('high')).toBe('high severity')
    expect(severityColor('high')).toBe('error')
    expect(severityColor('low')).toBe('neutral')
  })

  it('says who asked for the behaviour', () => {
    expect(sourceLabel('issue')).toBe('asked by: the issue')
    expect(sourceLabel('nobody')).toBe('asked by: nobody')
  })

  it('labels only line targets', () => {
    expect(lineLabel({ type: 'line', path: 'a.ts', side: 'head', line: 42, expectedText: '' })).toBe('line 42')
    expect(lineLabel({ type: 'file', path: 'a.ts' })).toBeNull()
  })
})

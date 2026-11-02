import { describe, expect, it } from 'vitest'
import { buildStartHereItems, openGeneralFindings } from './start-here-items.ts'
import type { GeneralAnnotation } from './types.ts'
import type { VerificationEntry } from './annotation-view.ts'

const general = (id: string, verdict: GeneralAnnotation['verdict']): GeneralAnnotation => ({
  id,
  target: { type: 'general' },
  summary: id,
  verdict,
  evidence: [],
  verification: [],
})

const entry: VerificationEntry = { verification: { id: 'vi-1', description: 'd', status: 'gap' }, path: 'a.ts' }

describe('start here items', () => {
  it('drops general findings that are intended', () => {
    expect(openGeneralFindings([general('a', 'intended'), general('b', 'missing'), general('c', undefined)]).map((a) => a.id)).toEqual(['b', 'c'])
  })

  it('lists general findings before verification entries', () => {
    const items = buildStartHereItems([general('b', 'missing')], [entry])
    expect(items.map((i) => i.kind)).toEqual(['general', 'verification'])
  })
})

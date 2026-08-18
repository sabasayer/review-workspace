import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Comparison } from '../schema/types.ts'
import { buildHandoffMarkdown } from './build-handoff-markdown.ts'
import { parseHandoffMetadata } from './parse-handoff-metadata.ts'

const comparison: Comparison = {
  base: 'aaa1111',
  head: 'bbb2222',
  repository: 'example/widgets',
  number: '42',
}

describe('parseHandoffMetadata', () => {
  it('round-trips against buildHandoffMarkdown\'s own output', () => {
    const markdown = buildHandoffMarkdown({
      bundlePath: 'fixtures/bundles/valid',
      comparison,
      round: 3,
      comments: [],
      annotations: [],
    })

    expect(parseHandoffMetadata(markdown)).toEqual({
      bundlePath: resolve('fixtures/bundles/valid'),
      repository: 'example/widgets',
      mrNumber: '42',
      round: 3,
    })
  })

  it('returns undefined when there is no metadata block at all', () => {
    expect(parseHandoffMetadata('# Change requests — round 1\n\nNo metadata here.\n')).toBeUndefined()
  })

  it('returns undefined when the metadata block is missing a required field', () => {
    const markdown = [
      '# Change requests — round 1',
      '',
      '<!--',
      'review-workspace-handoff',
      `bundlePath: ${resolve('fixtures/bundles/valid')}`,
      'mrNumber: 42',
      'round: 1',
      '-->',
      '',
    ].join('\n')

    expect(parseHandoffMetadata(markdown)).toBeUndefined()
  })

  it('returns undefined when round is not a valid integer', () => {
    const markdown = [
      '<!--',
      'review-workspace-handoff',
      `bundlePath: ${resolve('fixtures/bundles/valid')}`,
      'repository: example/widgets',
      'mrNumber: 42',
      'round: not-a-number',
      '-->',
      '',
    ].join('\n')

    expect(parseHandoffMetadata(markdown)).toBeUndefined()
  })
})

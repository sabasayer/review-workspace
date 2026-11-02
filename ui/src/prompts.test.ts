import { describe, expect, it } from 'vitest'
import { answerQuestionPrompt, bundleReference, nextRoundPrompt, postToMrPrompt, targetLabel } from './prompts.ts'

const generatorPrompt = 'Invoke the /review-workspace skill on this bundle: /tmp/bundles/mr-7'

describe('prompts', () => {
  it('reads the bundle path out of the generator prompt', () => {
    expect(bundleReference(generatorPrompt)).toBe('/tmp/bundles/mr-7')
    expect(bundleReference('something else')).toBe('something else')
  })

  it('builds the next-round prompt', () => {
    expect(nextRoundPrompt(generatorPrompt, 'fff3333')).toBe(
      'Invoke the /review-workspace skill on this bundle /tmp/bundles/mr-7: the MR has new commits (live head fff3333). Start the next round.',
    )
  })

  it('labels targets', () => {
    expect(targetLabel({ type: 'line', path: 'a.ts', side: 'head', line: 4, expectedText: '' })).toBe('a.ts:4')
    expect(targetLabel({ type: 'file', path: 'a.ts' })).toBe('a.ts')
    expect(targetLabel(undefined)).toBe('the whole MR')
  })

  it('builds the answer prompt with the Question and its target', () => {
    expect(answerQuestionPrompt(generatorPrompt, { body: 'Why 60?', target: { type: 'file', path: 'a.ts' } })).toBe(
      'Invoke the /review-workspace skill on this bundle /tmp/bundles/mr-7: answer this Question on a.ts: Why 60?',
    )
  })

  it('builds the post-to-MR prompt from the edited text', () => {
    expect(postToMrPrompt({ type: 'line', path: 'a.ts', side: 'head', line: 4, expectedText: '' }, '  Fix this. ')).toBe(
      'Post this comment to the MR inline: a.ts:4 Fix this.',
    )
  })

  it('builds a general post prompt that waits for send and for consent', () => {
    expect(postToMrPrompt({ type: 'general' }, ' Add a changelog. ')).toBe(
      'Draft this as a general MR comment, not an inline one. Post it only after I say "send" and agree to a general comment: Add a changelog.',
    )
  })

  it('labels a general target', () => {
    expect(targetLabel({ type: 'general' })).toBe('the whole MR')
  })
})

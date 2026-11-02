import { describe, expect, it } from 'vitest'
import { createAnswerTracker } from './answer-tracker.ts'
import type { Answer } from './types.ts'

const answer = (id: string, questionId = `q-${id}`): Answer => ({ id, questionId, body: 'text' })

describe('createAnswerTracker', () => {
  it('treats the Answers of the first load as already seen', () => {
    const tracker = createAnswerTracker()
    expect(tracker.sync([answer('a1')])).toEqual([])
    expect(tracker.unseenCount.value).toBe(0)
  })

  it('reports an Answer that arrives later, once', () => {
    const tracker = createAnswerTracker()
    tracker.sync([answer('a1')])
    expect(tracker.sync([answer('a1'), answer('a2')]).map((a) => a.id)).toEqual(['a2'])
    expect(tracker.sync([answer('a1'), answer('a2')])).toEqual([])
  })

  it('counts new Answers as unseen until the Reviewer sees them', () => {
    const tracker = createAnswerTracker()
    tracker.sync([])
    tracker.sync([answer('a1'), answer('a2')])
    expect(tracker.unseenCount.value).toBe(2)
    tracker.markSeenForQuestion('q-a1')
    expect(tracker.unseenCount.value).toBe(1)
    tracker.markSeenForQuestion('q-a2')
    expect(tracker.unseenCount.value).toBe(0)
  })

  it('ignores a question with no Answer', () => {
    const tracker = createAnswerTracker()
    tracker.sync([])
    tracker.sync([answer('a1')])
    tracker.markSeenForQuestion('nobody')
    expect(tracker.unseenCount.value).toBe(1)
  })

  it('treats an empty first load as the baseline too', () => {
    const tracker = createAnswerTracker()
    tracker.sync([])
    expect(tracker.sync([answer('a1')]).map((a) => a.id)).toEqual(['a1'])
  })
})

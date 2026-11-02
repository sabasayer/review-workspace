import { beforeEach, describe, expect, it } from 'vitest'
import {
  closePanel,
  openComposer,
  openThread,
  panelState,
  resetPanel,
  selectComposerTarget,
  togglePanel,
} from './question-panel-store.ts'
import type { Question } from '../types.ts'

const lineTarget = { type: 'line', path: 'a.ts', side: 'head', line: 4, expectedText: 'x' } as const
const question = (over: Partial<Question> = {}): Question => ({
  id: 'q1',
  createdAt: 't',
  body: 'Why?',
  kind: 'question',
  status: 'open',
  resolved: false,
  originRound: 1,
  target: lineTarget,
  ...over,
})

beforeEach(resetPanel)

describe('question panel store', () => {
  it('opens on a thread and takes that thread target for the composer', () => {
    openThread(question())
    expect(panelState.open).toBe(true)
    expect(panelState.threadId).toBe('q1')
    expect(panelState.composerTarget).toEqual(lineTarget)
    expect(panelState.anchorTarget).toEqual(lineTarget)
  })

  it('uses the whole change for a Comment without a Target', () => {
    openThread(question({ target: undefined }))
    expect(panelState.composerTarget).toEqual({ type: 'general' })
  })

  it('opens the composer for a Target with an optional draft and no open thread', () => {
    openThread(question())
    openComposer({ target: { type: 'general' }, draft: 'About it: ', kind: 'change-request' })
    expect(panelState).toMatchObject({
      open: true,
      threadId: null,
      composerTarget: { type: 'general' },
      draft: 'About it: ',
      kind: 'change-request',
    })
  })

  it('defaults the composer to an empty Question draft', () => {
    openComposer({ target: lineTarget })
    expect(panelState).toMatchObject({ draft: '', kind: 'question' })
  })

  it('lets the Reviewer pick another Target without closing the thread', () => {
    openThread(question())
    selectComposerTarget({ type: 'general' })
    expect(panelState.composerTarget).toEqual({ type: 'general' })
    expect(panelState.anchorTarget).toEqual(lineTarget)
    expect(panelState.threadId).toBe('q1')
  })

  it('stays open after a close and reopen toggle', () => {
    togglePanel()
    expect(panelState.open).toBe(true)
    togglePanel()
    expect(panelState.open).toBe(false)
    closePanel()
    expect(panelState.open).toBe(false)
  })
})

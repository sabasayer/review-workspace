import type { Target } from '../schema/types.ts'

export interface BehavioralGroupProgress {
  understood: boolean
  verified: boolean
}

export interface Concern {
  id: string
  note: string
  target?: Target
}

export interface ReviewState {
  groups: Record<string, BehavioralGroupProgress>
  concerns: Concern[]
  notes: string[]
  decision: 'unset' | 'approve' | 'request-changes'
}

export const EMPTY_REVIEW_STATE: ReviewState = {
  groups: {},
  concerns: [],
  notes: [],
  decision: 'unset',
}

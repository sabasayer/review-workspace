export interface BehavioralGroupProgress {
  understood: boolean
  verified: boolean
}

export interface ReviewState {
  groups: Record<string, BehavioralGroupProgress>
  notes: string[]
  decision: 'unset' | 'approve' | 'request-changes'
}

export const EMPTY_REVIEW_STATE: ReviewState = {
  groups: {},
  notes: [],
  decision: 'unset',
}

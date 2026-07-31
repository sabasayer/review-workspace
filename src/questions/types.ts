import type { Target } from '../schema/types.ts'

export type QuestionLogEntry =
  | { type: 'raised'; id: string; createdAt: string; body: string; target?: Target }
  | { type: 'withdrawn'; id: string; createdAt: string; questionId: string; replacementId?: string }

export interface Question {
  id: string
  createdAt: string
  body: string
  target?: Target
  status: 'open' | 'withdrawn'
  supersededBy?: string
}

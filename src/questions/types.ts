import type { Target } from '../schema/types.ts'

export type CommentKind = 'question' | 'change-request'

export type CommentLogEntry =
  | { type: 'raised'; id: string; createdAt: string; body: string; target?: Target; kind?: CommentKind }
  | { type: 'withdrawn'; id: string; createdAt: string; questionId: string; replacementId?: string }

export interface Comment {
  id: string
  createdAt: string
  body: string
  target?: Target
  kind: CommentKind
  status: 'open' | 'withdrawn'
  supersededBy?: string
}

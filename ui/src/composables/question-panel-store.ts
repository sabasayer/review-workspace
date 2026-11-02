import { reactive } from 'vue'
import type { CommentKind, Question, Target } from '../types.ts'

interface PanelState {
  open: boolean
  threadId: string | null
  anchorTarget: Target
  composerTarget: Target
  draft: string
  kind: CommentKind
}

const WHOLE_CHANGE: Target = { type: 'general' }

const initial = (): PanelState => ({ open: false, threadId: null, anchorTarget: WHOLE_CHANGE, composerTarget: WHOLE_CHANGE, draft: '', kind: 'question' })

export const panelState = reactive<PanelState>(initial())

export function resetPanel(): void {
  Object.assign(panelState, initial())
}

export function openThread(question: Pick<Question, 'id' | 'target'>): void {
  panelState.open = true
  panelState.threadId = question.id
  panelState.anchorTarget = question.target ?? WHOLE_CHANGE
  panelState.composerTarget = panelState.anchorTarget
}

export function openComposer(options: { target: Target; draft?: string; kind?: CommentKind }): void {
  panelState.open = true
  panelState.threadId = null
  panelState.anchorTarget = options.target
  panelState.composerTarget = options.target
  panelState.draft = options.draft ?? ''
  panelState.kind = options.kind ?? 'question'
}

export function selectComposerTarget(target: Target): void {
  panelState.composerTarget = target
}

export function togglePanel(): void {
  panelState.open = !panelState.open
}

export function closePanel(): void {
  panelState.open = false
}

import { reactive } from 'vue'
import type { PanelTab } from '../question-panel.ts'
import type { CommentKind, Question, Target } from '../types.ts'

interface PanelState {
  open: boolean
  threadId: string | null
  anchorTarget: Target
  composerTarget: Target
  draft: string
  kind: CommentKind
  tab: PanelTab
}

const WHOLE_CHANGE: Target = { type: 'general' }

const initial = (): PanelState => ({ open: false, threadId: null, anchorTarget: WHOLE_CHANGE, composerTarget: WHOLE_CHANGE, draft: '', kind: 'question', tab: 'question' })

export const panelState = reactive<PanelState>(initial())

export function resetPanel(): void {
  Object.assign(panelState, initial())
}

export function openThread(question: Pick<Question, 'id' | 'target' | 'kind'>): void {
  panelState.tab = question.kind
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
  panelState.tab = panelState.kind
}

export function setPanelTab(tab: PanelTab): void {
  panelState.tab = tab
  if (panelState.draft === '') panelState.kind = tab
}

export function setComposerKind(kind: CommentKind): void {
  panelState.kind = kind
  panelState.tab = kind
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

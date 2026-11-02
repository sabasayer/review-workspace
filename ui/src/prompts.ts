import type { Question, Target } from './types.ts'

const BUNDLE_REFERENCE = /on this bundle:? (.+)$/

export function bundleReference(generatorPrompt: string): string {
  return BUNDLE_REFERENCE.exec(generatorPrompt)?.[1] ?? generatorPrompt
}

export function nextRoundPrompt(generatorPrompt: string, liveHead: string): string {
  return `Invoke the /review-workspace skill on this bundle ${bundleReference(generatorPrompt)}: the MR has new commits (live head ${liveHead}). Start the next round.`
}

export function targetLabel(target: Target | undefined): string {
  if (!target || target.type === 'general') return 'the whole MR'
  return target.type === 'line' ? `${target.path}:${target.line}` : target.path
}

export function answerQuestionPrompt(generatorPrompt: string, question: Pick<Question, 'body' | 'target'>): string {
  return `Invoke the /review-workspace skill on this bundle ${bundleReference(generatorPrompt)}: answer this Question on ${targetLabel(question.target)}: ${question.body}`
}

export function postToMrPrompt(target: Target | undefined, text: string): string {
  if (target?.type === 'general') {
    return `Draft this as a general MR comment, not an inline one. Post it only after I say "send" and agree to a general comment: ${text.trim()}`
  }
  return `Post this comment to the MR inline: ${targetLabel(target)} ${text.trim()}`
}

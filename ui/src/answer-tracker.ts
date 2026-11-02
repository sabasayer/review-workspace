import { computed, reactive } from 'vue'
import type { Answer } from './types.ts'

export function createAnswerTracker() {
  const state = reactive({ loaded: false, known: new Set<string>(), seen: new Set<string>(), answers: [] as Answer[] })

  function sync(answers: readonly Answer[]): Answer[] {
    const arrived = state.loaded ? answers.filter((a) => !state.known.has(a.id)) : []
    for (const answer of answers) state.known.add(answer.id)
    if (!state.loaded) for (const answer of answers) state.seen.add(answer.id)
    state.loaded = true
    state.answers = [...answers]
    return arrived
  }

  function markSeenForQuestion(questionId: string): void {
    for (const answer of state.answers) if (answer.questionId === questionId) state.seen.add(answer.id)
  }

  const unseenCount = computed(() => state.answers.filter((a) => !state.seen.has(a.id)).length)

  return { sync, markSeenForQuestion, unseenCount }
}

export const answerTracker = createAnswerTracker()

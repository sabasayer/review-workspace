import { watch } from 'vue'
import { answerTracker } from '../answer-tracker.ts'
import type { Answer } from '../types.ts'
import { openThread, panelState } from './question-panel-store.ts'
import { useQuestionsStore } from './questions-store.ts'

const TOAST_MS = 10_000

export function useAnswerNotifications(answers: () => readonly Answer[] | undefined) {
  const toast = useToast()
  const questions = useQuestionsStore()

  function announce(answer: Answer) {
    const question = questions.questions.find((q) => q.id === answer.questionId)
    toast.add({
      title: 'New answer',
      description: question?.body ?? 'The agent answered a Question.',
      icon: 'i-lucide-message-circle-reply',
      duration: TOAST_MS,
      actions: question ? [{ label: 'Open', color: 'neutral', variant: 'outline', onClick: () => openThread(question) }] : [],
    })
  }

  function markOpenThreadSeen() {
    if (panelState.open && panelState.threadId) answerTracker.markSeenForQuestion(panelState.threadId)
  }

  watch(
    answers,
    (list) => {
      if (!list) return
      answerTracker.sync(list).forEach(announce)
      markOpenThreadSeen()
    },
    { immediate: true },
  )
  watch(() => [panelState.open, panelState.threadId], markOpenThreadSeen)

  return { unseenCount: answerTracker.unseenCount }
}

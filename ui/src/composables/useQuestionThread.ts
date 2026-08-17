import { ref } from 'vue'
import type { CommentKind, Target } from '../types.ts'
import { raiseQuestion, resolveComment, useQuestionsStore, withdrawAndReplaceQuestion } from './questions-store.ts'

export function useQuestionThread(target: () => Target | undefined) {
  const store = useQuestionsStore()
  const draft = ref('')
  const draftKind = ref<CommentKind>('question')
  const busy = ref(false)
  const localError = ref<string | null>(null)
  const editingId = ref<string | null>(null)
  const editDraft = ref('')

  async function submitNewQuestion(close: () => void) {
    if (!draft.value.trim()) return
    busy.value = true
    localError.value = null
    try {
      await raiseQuestion(draft.value.trim(), target(), draftKind.value)
      draft.value = ''
      draftKind.value = 'question'
      close()
    } catch (err) {
      localError.value = err instanceof Error ? err.message : String(err)
    } finally {
      busy.value = false
    }
  }

  function startEdit(questionId: string) {
    editingId.value = questionId
    editDraft.value = ''
  }

  async function submitEdit(questionId: string, close: () => void) {
    if (!editDraft.value.trim()) return
    busy.value = true
    localError.value = null
    try {
      await withdrawAndReplaceQuestion(questionId, editDraft.value.trim(), target())
      editingId.value = null
      editDraft.value = ''
      close()
    } catch (err) {
      localError.value = err instanceof Error ? err.message : String(err)
    } finally {
      busy.value = false
    }
  }

  async function resolve(commentId: string) {
    busy.value = true
    localError.value = null
    try {
      await resolveComment(commentId)
    } catch (err) {
      localError.value = err instanceof Error ? err.message : String(err)
    } finally {
      busy.value = false
    }
  }

  return {
    store,
    draft,
    draftKind,
    busy,
    localError,
    editingId,
    editDraft,
    submitNewQuestion,
    startEdit,
    submitEdit,
    resolve,
  }
}

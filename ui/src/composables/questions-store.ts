import { reactive, readonly } from 'vue'
import type { Question, Target } from '../types.ts'

const WRITE_TOKEN_KEY = 'review-workspace:write-token'

const state = reactive({
  questions: [] as Question[],
  writeToken: localStorage.getItem(WRITE_TOKEN_KEY) ?? '',
  loading: false,
  error: null as string | null,
})

export function setWriteToken(token: string) {
  state.writeToken = token
  localStorage.setItem(WRITE_TOKEN_KEY, token)
}

async function parseErrorBody(res: Response): Promise<string> {
  const body = await res.json().catch(() => ({}))
  return body.error ?? res.statusText
}

export async function loadQuestions(): Promise<void> {
  state.loading = true
  try {
    const res = await fetch('/api/questions')
    if (!res.ok) throw new Error(`GET /questions failed: ${await parseErrorBody(res)}`)
    state.questions = await res.json()
    state.error = null
  } catch (err) {
    state.error = err instanceof Error ? err.message : String(err)
  } finally {
    state.loading = false
  }
}

export async function raiseQuestion(body: string, target?: Target): Promise<void> {
  const res = await fetch('/api/questions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-write-token': state.writeToken },
    body: JSON.stringify({ body, target }),
  })
  if (!res.ok) throw new Error(`Could not raise Question: ${await parseErrorBody(res)}`)
  await loadQuestions()
}

export async function withdrawAndReplaceQuestion(id: string, body: string, target?: Target): Promise<void> {
  const res = await fetch(`/api/questions/${id}/withdraw`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-write-token': state.writeToken },
    body: JSON.stringify({ body, target }),
  })
  if (!res.ok) throw new Error(`Could not withdraw Question: ${await parseErrorBody(res)}`)
  await loadQuestions()
}

export function useQuestionsStore() {
  return readonly(state)
}

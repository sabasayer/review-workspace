<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { fetchView } from '../api.ts'
import type { Answer, Question, RenderedFile, RenderedGroup, ViewModel } from '../types.ts'
import FileNav from '../components/FileNav.vue'
import DiffFile from '../components/DiffFile.vue'
import { loadQuestions, setWriteToken, useQuestionsStore } from '../questions-store.ts'
import { renderMarkdown } from '../markdown.ts'
import { anchorId, lineAnchorId } from '../diff-layout.ts'
import { expandHunk } from '../expanded-hunks-store.ts'
import { currentFiles } from '../view-model-store.ts'

const viewModel = ref<ViewModel | null>(null)
const error = ref<string | null>(null)
const layout = ref<'inline' | 'side-by-side'>('inline')
const navVisible = ref(true)

const questionsStore = useQuestionsStore()
const writeTokenDraft = ref(questionsStore.writeToken)

function saveWriteToken(close: () => void) {
  setWriteToken(writeTokenDraft.value.trim())
  close()
}

async function refresh() {
  try {
    viewModel.value = await fetchView()
    currentFiles.value = viewModel.value.files
    error.value = null
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  }
  await loadQuestions()
}

// Plain polling, not a websocket/SSE — this is a local review tool with one loopback
// server and no concurrent-editor scaling concern, so the simplest thing that removes
// "you must refresh the page" is a short interval, not a persistent-connection protocol.
const POLL_INTERVAL_MS = 4000
let pollTimer: ReturnType<typeof setInterval> | undefined

onMounted(async () => {
  await refresh()
  pollTimer = setInterval(refresh, POLL_INTERVAL_MS)
})

onBeforeUnmount(() => clearInterval(pollTimer))

interface GroupBucket {
  group: RenderedGroup | null
  filePaths: string[]
  files: RenderedFile[]
}

// Buckets the flat, already-ordered vm.files back into their Behavioral Groups for
// section headers — the ordering itself (group order, then patch-order fallback)
// was already decided by the engine's render(); this only reconstructs the grouping
// for display, it never re-sorts.
const groupedFiles = computed<GroupBucket[]>(() => {
  const vm = viewModel.value
  if (!vm) return []
  const assigned = new Set<string>()
  const buckets: GroupBucket[] = vm.groups.map((group) => {
    const files = group.filePaths.map((p) => vm.files.find((f) => f.path === p)).filter((f): f is RenderedFile => !!f)
    files.forEach((f) => assigned.add(f.path))
    return { group, filePaths: files.map((f) => f.path), files }
  })
  const rest = vm.files.filter((f) => !assigned.has(f.path))
  if (rest.length) buckets.push({ group: null, filePaths: rest.map((f) => f.path), files: rest })
  return buckets
})

// Sequential numbering for annotation badges, in reading order (per file: file-level
// notes first, then each hunk's lines top to bottom) — computed from the already-ordered
// view model rather than measuring rendered DOM position like the static prototype did.
const annotationNumbers = computed<Map<string, number>>(() => {
  const numbers = new Map<string, number>()
  let next = 1
  for (const bucket of groupedFiles.value) {
    for (const file of bucket.files) {
      for (const a of file.annotations) {
        if (a.target.type !== 'line') numbers.set(a.id, next++)
      }
      for (const hunk of file.hunks) {
        for (const line of hunk.lines) {
          for (const a of line.annotations) numbers.set(a.id, next++)
        }
      }
    }
  }
  return numbers
})

const hasMrMetadata = computed(() => {
  const c = viewModel.value?.comparison
  return !!c && !!(c.title || c.url || c.author || c.sourceBranch || c.description)
})

const headerTitle = computed(() => {
  const c = viewModel.value?.comparison
  if (!c) return 'Review Workspace'
  if (c.title) return c.number ? `!${c.number} ${c.title}` : c.title
  return `${c.base} → ${c.head}`
})

const mrInfoOpen = ref(false)

const descriptionHtml = computed(() => {
  const c = viewModel.value?.comparison
  if (!c?.description) return ''
  return renderMarkdown(c.description, c.url)
})

interface QuestionEntry {
  question: Question
  answer: Answer | undefined
  filePath?: string
  hunkIndex?: number
  lineId?: string
}

// Resolves each Question's target down to an actual RenderedLine (and which hunk it's
// in, since that hunk may currently be collapsed) so clicking it in the panel can both
// expand the right fold and land on the exact line — not just the right file.
const questionEntries = computed<QuestionEntry[]>(() => {
  const vm = viewModel.value
  if (!vm) return []
  return questionsStore.questions.map((question): QuestionEntry => {
    const answer = vm.answers.find((a) => a.questionId === question.id)
    const target = question.target
    if (!target) return { question, answer }
    const file = vm.files.find((f) => f.path === target.path)
    if (!file) return { question, answer, filePath: target.path }
    if (target.type === 'line') {
      for (let hunkIndex = 0; hunkIndex < file.hunks.length; hunkIndex++) {
        const line = file.hunks[hunkIndex].lines.find((l) =>
          target.side === 'base' ? l.oldLine === target.line : l.newLine === target.line,
        )
        if (line) return { question, answer, filePath: file.path, hunkIndex, lineId: line.id }
      }
    }
    return { question, answer, filePath: file.path }
  })
})

const openQuestionCount = computed(() => questionEntries.value.filter((e) => e.question.status === 'open' && !e.answer).length)

const questionsOpen = ref(false)

async function scrollToQuestion(entry: QuestionEntry) {
  questionsOpen.value = false
  if (!entry.filePath) return
  if (entry.hunkIndex !== undefined) expandHunk(entry.filePath, entry.hunkIndex)
  await nextTick()
  const id = entry.lineId ? lineAnchorId(entry.lineId) : anchorId(entry.filePath)
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

const promptCopied = ref(false)
let copiedResetTimer: ReturnType<typeof setTimeout> | undefined

async function copyPrompt() {
  if (!viewModel.value) return
  await navigator.clipboard.writeText(viewModel.value.generatorPrompt)
  promptCopied.value = true
  clearTimeout(copiedResetTimer)
  copiedResetTimer = setTimeout(() => (promptCopied.value = false), 1500)
}
</script>

<template>
  <div class="flex h-screen flex-col bg-default text-default">
    <header class="flex items-center gap-3 border-b border-default px-4 py-3">
      <UTooltip :text="navVisible ? 'Hide file list' : 'Show file list'">
        <UButton
          size="sm"
          color="neutral"
          :variant="navVisible ? 'subtle' : 'ghost'"
          icon="i-lucide-panel-left"
          :aria-pressed="navVisible"
          @click="navVisible = !navVisible"
        />
      </UTooltip>

      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <h1 class="truncate text-sm font-semibold">
            {{ headerTitle }}
          </h1>
          <UButton
            v-if="viewModel && hasMrMetadata"
            size="xs"
            variant="soft"
            color="primary"
            icon="i-lucide-file-text"
            @click="mrInfoOpen = true"
          >
            Details
          </UButton>
        </div>
        <div v-if="viewModel && hasMrMetadata" class="mt-0.5 flex items-center gap-2 text-xs text-muted">
          <a
            v-if="viewModel.comparison.url"
            :href="viewModel.comparison.url"
            target="_blank"
            rel="noopener"
            class="truncate text-primary hover:underline"
          >
            {{ viewModel.comparison.url }}
          </a>
          <span v-if="viewModel.comparison.sourceBranch" class="shrink-0 font-mono">
            {{ viewModel.comparison.sourceBranch }} → {{ viewModel.comparison.targetBranch ?? 'main' }}
          </span>
        </div>
      </div>

      <div class="ml-auto flex items-center gap-3">
        <UTooltip v-if="viewModel" text="All questions">
          <UChip :text="openQuestionCount" :show="openQuestionCount > 0" color="warning" size="sm">
            <UButton size="sm" variant="ghost" color="neutral" icon="i-lucide-message-circle-question" @click="questionsOpen = true" />
          </UChip>
        </UTooltip>

        <div class="h-5 w-px bg-default" />

        <UFieldGroup size="sm">
          <UTooltip text="Inline diff">
            <UButton
              icon="i-lucide-align-justify"
              :variant="layout === 'inline' ? 'solid' : 'outline'"
              color="neutral"
              @click="layout = 'inline'"
            />
          </UTooltip>
          <UTooltip text="Side-by-side diff">
            <UButton
              icon="i-lucide-columns-2"
              :variant="layout === 'side-by-side' ? 'solid' : 'outline'"
              color="neutral"
              @click="layout = 'side-by-side'"
            />
          </UTooltip>
        </UFieldGroup>

        <div class="h-5 w-px bg-default" />

        <UTooltip v-if="viewModel" :text="promptCopied ? 'Copied!' : 'Copy Generator prompt'">
          <UButton
            size="sm"
            variant="ghost"
            :color="promptCopied ? 'success' : 'neutral'"
            :icon="promptCopied ? 'i-lucide-check' : 'i-lucide-clipboard-copy'"
            @click="copyPrompt"
          />
        </UTooltip>

        <div class="h-5 w-px bg-default" />

        <UPopover>
          <UTooltip :text="questionsStore.writeToken ? 'Write token set' : 'Set write token'">
            <UButton
              size="sm"
              variant="ghost"
              :color="questionsStore.writeToken ? 'primary' : 'warning'"
              icon="i-lucide-key"
            />
          </UTooltip>
          <template #content="{ close }">
            <div class="w-80 p-3">
              <p class="mb-2 text-xs text-muted">
                Paste the write token printed by <code class="font-mono">review-workspace serve</code>. Needed to raise
                Questions or change Review State — read-only viewing works without it.
              </p>
              <UInput v-model="writeTokenDraft" size="sm" class="w-full" placeholder="write token" @keyup.enter="saveWriteToken(close)" />
              <UButton size="sm" class="mt-2" block @click="saveWriteToken(close)">Save</UButton>
            </div>
          </template>
        </UPopover>

        <UTooltip text="Toggle color mode">
          <UColorModeButton size="sm" />
        </UTooltip>
      </div>
    </header>

    <USlideover v-if="viewModel" v-model:open="mrInfoOpen" :title="viewModel.comparison.title || 'MR details'" side="right">
      <template #body>
        <div class="space-y-4 text-sm">
          <div v-if="viewModel.comparison.number" class="text-muted">!{{ viewModel.comparison.number }}</div>
          <a
            v-if="viewModel.comparison.url"
            :href="viewModel.comparison.url"
            target="_blank"
            rel="noopener"
            class="block truncate text-primary hover:underline"
          >
            {{ viewModel.comparison.url }}
          </a>
          <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-muted">
            <template v-if="viewModel.comparison.author">
              <dt>Author</dt>
              <dd class="text-default">{{ viewModel.comparison.author }}</dd>
            </template>
            <template v-if="viewModel.comparison.sourceBranch || viewModel.comparison.targetBranch">
              <dt>Branch</dt>
              <dd class="text-default font-mono">
                {{ viewModel.comparison.sourceBranch ?? '?' }} → {{ viewModel.comparison.targetBranch ?? '?' }}
              </dd>
            </template>
            <template v-if="viewModel.comparison.repository">
              <dt>Repository</dt>
              <dd class="text-default">{{ viewModel.comparison.repository }}</dd>
            </template>
          </dl>
          <div v-if="descriptionHtml" class="markdown-body border-t border-default pt-4" v-html="descriptionHtml" />
        </div>
      </template>
    </USlideover>

    <USlideover v-model:open="questionsOpen" title="Questions" side="right">
      <template #body>
        <p v-if="!questionEntries.length" class="text-sm text-muted">No Questions raised on this bundle yet.</p>
        <ul class="space-y-3">
          <li v-for="entry in questionEntries" :key="entry.question.id" class="rounded-lg border border-default p-3 text-sm">
            <button
              type="button"
              class="block w-full text-left"
              :disabled="!entry.filePath"
              @click="scrollToQuestion(entry)"
            >
              <div class="mb-1 flex items-center gap-2">
                <UBadge
                  size="sm"
                  variant="subtle"
                  :color="entry.answer ? 'success' : entry.question.status === 'open' ? 'warning' : 'neutral'"
                >
                  {{ entry.answer ? 'Answered' : entry.question.status === 'open' ? 'Open' : 'Withdrawn' }}
                </UBadge>
                <span v-if="entry.filePath" class="truncate font-mono text-xs text-muted">{{ entry.filePath }}</span>
              </div>
              <p class="leading-relaxed" :class="{ 'text-muted line-through': entry.question.status === 'withdrawn' }">
                {{ entry.question.body }}
              </p>
              <div v-if="entry.answer" class="mt-2 border-t border-default pt-2 text-muted">
                <p class="mb-0.5 text-[10px] font-bold">Answer</p>
                <p class="leading-relaxed whitespace-pre-wrap">{{ entry.answer.body }}</p>
              </div>
            </button>
          </li>
        </ul>
      </template>
    </USlideover>

    <div v-if="error" class="p-4 text-error">Failed to load bundle: {{ error }}</div>
    <div v-else-if="!viewModel" class="p-4 text-muted">Loading…</div>

    <div v-else class="flex flex-1 overflow-hidden">
      <aside v-if="navVisible" class="w-64 shrink-0 overflow-y-auto border-r border-default p-3">
        <FileNav :groups="groupedFiles" />
      </aside>
      <main class="flex-1 overflow-y-auto p-4">
        <div v-if="viewModel.diagnostics.length" class="mb-4 rounded border border-warning/50 bg-warning/10 p-3 text-xs">
          <strong>{{ viewModel.diagnostics.length }} bundle-level diagnostic(s)</strong>
        </div>
        <section v-for="(bucket, i) in groupedFiles" :key="bucket.group?.id ?? `ungrouped-${i}`" class="mb-8">
          <h2 v-if="bucket.group" class="mb-2 text-base font-semibold">{{ bucket.group.title }}</h2>
          <h2 v-else class="mb-2 text-base font-semibold text-muted">Other changes</h2>
          <DiffFile
            v-for="file in bucket.files"
            :key="file.path"
            :file="file"
            :layout="layout"
            :annotation-numbers="annotationNumbers"
            :questions="questionsStore.questions"
            :answers="viewModel.answers"
          />
        </section>
      </main>
    </div>
  </div>
</template>


#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const DEFAULT_CAP = 20
const DEFAULT_MODEL = 'haiku'
const MAX_CODE_LINES = 80

const readJson = (path, fallback) => (existsSync(path) ? JSON.parse(readFileSync(path, 'utf-8')) : fallback)

export function readOpenQuestions(bundle) {
  const path = join(bundle, 'questions.jsonl')
  if (!existsSync(path)) return []
  const byId = new Map()
  for (const line of readFileSync(path, 'utf-8').split('\n').filter(Boolean)) {
    const entry = JSON.parse(line)
    if (entry.type === 'raised') byId.set(entry.id, { ...entry, kind: entry.kind ?? 'question', status: 'open' })
    if (entry.type === 'withdrawn' && byId.has(entry.questionId)) byId.get(entry.questionId).status = 'withdrawn'
  }
  return [...byId.values()].filter((q) => q.kind === 'question' && q.status === 'open')
}

export function targetCode(diff, target) {
  if (!target || !['file', 'hunk', 'line'].includes(target.type)) return ''
  const splitter = /^diff --git /m.test(diff) ? /^(?=diff --git )/m : /^(?=--- )/m
  const section = diff.split(splitter).find((s) => s.includes(target.path))
  if (!section) return ''
  const [header, ...hunks] = section.split(/^(?=@@ )/m)
  let picked = hunks
  if (target.type === 'hunk') picked = hunks.slice(target.hunkIndex, target.hunkIndex + 1)
  if (target.type === 'line') {
    const hit = hunks.find((hunk) => {
      const m = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(hunk)
      if (!m) return false
      const [start, len] = target.side === 'base' ? [+m[1], +(m[2] ?? 1)] : [+m[3], +(m[4] ?? 1)]
      return target.line >= start && target.line < start + len
    })
    picked = hit ? [hit] : []
  }
  return [header, ...picked].join('').split('\n').slice(0, MAX_CODE_LINES).join('\n')
}

export function buildPrompt({ question, code, thread }) {
  const sameThread = thread.map((t) => `${t.role}: ${t.body}`).join('\n')
  return [
    'You answer one question from a code reviewer. Start from the text below.',
    'You may read files in the current directory with Read, Grep and Glob. You cannot change anything.',
    'Read only what the Question needs, then answer. Say which files you read.',
    'Write short plain sentences. Say "I do not know" when the files are not enough.',
    '',
    `Question:\n${question.body}`,
    code ? `\nCode the question points at:\n${code}` : '',
    sameThread ? `\nThread so far:\n${sameThread}` : '',
  ].join('\n')
}

export function threadFor(question, bundle) {
  const doc = readJson(join(bundle, 'review.next.json'), readJson(join(bundle, 'review.json'), {}))
  const answers = doc.answers ?? []
  return answers.filter((a) => a.questionId === question.id).map((a) => ({ role: 'answer', body: a.body }))
}

function answeredIds(bundle) {
  const ids = new Set()
  for (const file of ['review.json', 'review.next.json']) {
    for (const a of readJson(join(bundle, file), {}).answers ?? []) ids.add(a.questionId)
  }
  return ids
}

export function writeAnswer(bundle, questionId, body) {
  const next = join(bundle, 'review.next.json')
  const doc = readJson(next, readJson(join(bundle, 'review.json'), {}))
  doc.answers = [...(doc.answers ?? []), { id: `ans-${questionId}`, questionId, body }]
  writeFileSync(next, JSON.stringify(doc, null, 2))
}

export function writeWatcherState(bundle, state) {
  const stamped = { ...state, updatedAt: new Date().toISOString() }
  writeFileSync(join(bundle, 'watcher.json'), JSON.stringify(stamped, null, 2))
}

const READ_ONLY_TOOLS = ['Read', 'Grep', 'Glob']

export const claudeArgs = (model) => [
  '-p',
  '--model', model,
  '--tools', READ_ONLY_TOOLS.join(','),
  '--allowedTools', READ_ONLY_TOOLS.join(','),
  '--strict-mcp-config',
  '--no-session-persistence',
]

function readOnlyToolsOnly(args) {
  const listAfter = (flag) => args[args.indexOf(flag) + 1]?.split(',')
  const sameAsReadOnly = (list) => list?.length === READ_ONLY_TOOLS.length && list.every((t) => READ_ONLY_TOOLS.includes(t))
  return sameAsReadOnly(listAfter('--tools')) && sameAsReadOnly(listAfter('--allowedTools')) && args.includes('--strict-mcp-config')
}

const defaultRun = (prompt, model, repo) =>
  execFileSync('claude', claudeArgs(model), { input: prompt, encoding: 'utf-8', cwd: repo }).trim()

const defaultPublish = (bundle, repo) =>
  execFileSync('npx', ['review-workspace', 'publish', bundle, '--repo', repo], { stdio: 'inherit' })

export function processOnce({ bundle, repo, cap, model, run = defaultRun, publish = defaultPublish }) {
  const statePath = join(bundle, 'watcher.json')
  const state = readJson(statePath, { enabled: true, cap, used: 0 })
  state.cap = cap
  state.current = null
  if (!state.enabled) return state
  const diff = existsSync(join(bundle, 'changes.diff')) ? readFileSync(join(bundle, 'changes.diff'), 'utf-8') : ''
  const done = answeredIds(bundle)
  for (const question of readOpenQuestions(bundle).filter((q) => !done.has(q.id))) {
    if (state.used >= state.cap) break
    const prompt = buildPrompt({ question, code: targetCode(diff, question.target), thread: threadFor(question, bundle) })
    state.current = question.id
    writeWatcherState(bundle, state)
    try {
      const body = run(prompt, model, repo)
      if (!body) continue
      writeAnswer(bundle, question.id, body)
      publish(bundle, repo)
      state.used += 1
    } finally {
      state.current = null
      writeWatcherState(bundle, state)
    }
  }
  if (state.used >= state.cap) state.enabled = false
  writeWatcherState(bundle, state)
  return state
}

export function selfCheck() {
  const dir = mkdtempSync(join(tmpdir(), 'watch-questions-'))
  const bundle = join(dir, 'bundle')
  try {
    mkdirSync(bundle)
    writeFileSync(
      join(bundle, 'changes.diff'),
      'diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@ -1,2 +1,2 @@\n-old\n+new\n same\n',
    )
    writeFileSync(join(bundle, 'review.json'), JSON.stringify({ schemaVersion: 2, answers: [] }))
    const raised = (id, body, extra = {}) => JSON.stringify({ type: 'raised', id, createdAt: 'now', body, ...extra })
    writeFileSync(
      join(bundle, 'questions.jsonl'),
      [
        raised('q1', 'Why new?', { target: { type: 'line', path: 'a.ts', side: 'head', line: 1, expectedText: 'new' } }),
        raised('q2', 'Second?'),
        raised('q3', 'Third?'),
        raised('c1', 'Fix this', { kind: 'change-request' }),
      ].join('\n') + '\n',
    )
    const prompts = []
    const repos = []
    let published = 0
    const currentWhileRunning = []
    const run = (prompt, _model, repoPath) => {
      prompts.push(prompt)
      repos.push(repoPath)
      currentWhileRunning.push(readJson(join(bundle, 'watcher.json'), {}).current)
      return 'Short answer.'
    }
    const publish = () => { published += 1 }
    const state = processOnce({ bundle, repo: dir, cap: 2, model: 'x', run, publish })
    const doc = readJson(join(bundle, 'review.next.json'), {})
    const afterAnswers = readJson(join(bundle, 'watcher.json'), {})
    writeWatcherState(bundle, { enabled: true, cap: 5, used: 0, current: 'stale-id' })
    let modelFailed = false
    try {
      processOnce({ bundle, repo: dir, cap: 5, model: 'x', run: () => { throw new Error('model failed') }, publish })
    } catch {
      modelFailed = true
    }
    const afterError = readJson(join(bundle, 'watcher.json'), {})
    const idleBundle = join(dir, 'idle')
    mkdirSync(idleBundle)
    const staleStamp = '2000-01-01T00:00:00.000Z'
    writeFileSync(join(idleBundle, 'watcher.json'), JSON.stringify({ enabled: true, cap: 5, used: 0, current: null, updatedAt: staleStamp }))
    const beforeTick = Date.now()
    processOnce({ bundle: idleBundle, repo: dir, cap: 5, model: 'x', run, publish })
    const idleStamp = Date.parse(readJson(join(idleBundle, 'watcher.json'), {}).updatedAt)
    const isIsoDate = (value) => typeof value === 'string' && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value
    const checks = [
      ['answers 2 questions up to the cap', doc.answers.length === 2],
      ['skips the change-request', !doc.answers.some((a) => a.questionId === 'c1')],
      ['prompt holds the target code', prompts[0].includes('+new') && !prompts[0].includes('Second?')],
      ['publishes once per answer', published === 2],
      ['stops at the cap', state.used === 2 && state.enabled === false],
      ['writes watcher.json', afterAnswers.enabled === false && afterAnswers.used === 2 && afterAnswers.cap === 2],
      ['passes the repo path to the model run', repos.length === 2 && repos.every((r) => r === dir)],
      ['allows only read-only tools', readOnlyToolsOnly(claudeArgs('x'))],
      ['prompt tells the model to read, then answer', prompts[0].includes('Read only what the Question needs')],
      ['writes the Question id as current while it works', currentWhileRunning[0] === 'q1' && currentWhileRunning[1] === 'q2'],
      ['clears current after the Answer', afterAnswers.current === null && 'current' in afterAnswers],
      ['writes updatedAt as an ISO date-time', isIsoDate(afterAnswers.updatedAt)],
      ['refreshes updatedAt on a tick with nothing to answer', idleStamp >= beforeTick],
      ['clears current when the model fails', modelFailed && afterError.current === null && afterError.enabled === true],
    ]
    const failed = checks.filter(([, ok]) => !ok)
    for (const [name, ok] of checks) console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`)
    if (failed.length) process.exit(1)
    console.log('self-check passed')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

function main(argv) {
  if (argv.includes('--self-check')) return selfCheck()
  const flag = (name, fallback) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback)
  const bundleArg = argv.find((a) => !a.startsWith('--') && argv[argv.indexOf(a) - 1]?.startsWith('--') !== true)
  const bundle = bundleArg && resolve(bundleArg)
  const repo = flag('--repo') && resolve(flag('--repo'))
  if (!bundle || !repo) {
    console.error('Usage: watch-questions.mjs <bundle> --repo <path> [--cap 20] [--model haiku] [--once]')
    process.exit(2)
  }
  const cap = Number(flag('--cap', DEFAULT_CAP))
  const model = flag('--model', DEFAULT_MODEL)
  const once = argv.includes('--once')
  const tick = () => {
    const state = processOnce({ bundle, repo, cap, model })
    if (!state.enabled || once) {
      console.log(`watcher stopped: used ${state.used} of ${state.cap}`)
      process.exit(0)
    }
  }
  tick()
  setInterval(tick, 3000)
}

if (import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) main(process.argv.slice(2))

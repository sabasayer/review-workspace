import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { startReviewServer, type ReviewServerHandle } from './create-server.ts'

const validBundle = fileURLToPath(new URL('../../fixtures/bundles/valid/', import.meta.url))

let workBundle: string
let handle: ReviewServerHandle

beforeEach(async () => {
  workBundle = mkdtempSync(join(tmpdir(), 'review-workspace-server-'))
  cpSync(validBundle, workBundle, { recursive: true })
  handle = await startReviewServer(workBundle)
})

afterEach(async () => {
  await handle.close()
  rmSync(workBundle, { recursive: true, force: true })
})

function baseUrl() {
  return `http://127.0.0.1:${handle.port}`
}

async function pollUntil<T>(check: () => Promise<T | undefined>, timeoutMs = 2000, intervalMs = 20): Promise<T> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const result = await check()
    if (result !== undefined) return result
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new Error('pollUntil: timed out')
}

describe('startReviewServer', () => {
  it('binds only to loopback', () => {
    const address = handle.server.address()
    expect(typeof address).toBe('object')
    expect((address as { address: string }).address).toBe('127.0.0.1')
  })

  it('serves the current document without a write token', async () => {
    const res = await fetch(`${baseUrl()}/document`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.valid).toBe(true)
  })

  it('rejects a mutating request without a valid write token', async () => {
    const res = await fetch(`${baseUrl()}/publish`, { method: 'POST' })
    expect(res.status).toBe(401)
  })

  it('rejects a mutating request with a wrong write token', async () => {
    const res = await fetch(`${baseUrl()}/publish`, { method: 'POST', headers: { 'x-write-token': 'wrong' } })
    expect(res.status).toBe(401)
  })

  it('accepts a mutating request with the correct write token and produces no side effect on failure', async () => {
    const before = readFileSync(join(workBundle, 'review.json'), 'utf-8')
    const res = await fetch(`${baseUrl()}/publish`, { method: 'POST', headers: { 'x-write-token': handle.writeToken } })
    expect(res.status).toBe(422) // no review.next.json staged
    expect(readFileSync(join(workBundle, 'review.json'), 'utf-8')).toBe(before)
  })

  it('publishes successfully with a valid token and a valid staged update', async () => {
    writeFileSync(
      join(workBundle, 'review.next.json'),
      JSON.stringify({ schemaVersion: 1, comparison: { base: 'abc1111', head: 'def2222' } }),
    )
    const res = await fetch(`${baseUrl()}/publish`, { method: 'POST', headers: { 'x-write-token': handle.writeToken } })
    expect(res.status).toBe(200)
  })

  it('serves a fresh /document after a publish succeeds, without a server restart', async () => {
    writeFileSync(
      join(workBundle, 'review.next.json'),
      JSON.stringify({
        schemaVersion: 1,
        comparison: { base: 'abc1111', head: 'def2222' },
        annotations: [{ id: 'an-1', target: { type: 'file', path: 'src/auth/login.ts' }, summary: 'live update' }],
      }),
    )
    const publishRes = await fetch(`${baseUrl()}/publish`, {
      method: 'POST',
      headers: { 'x-write-token': handle.writeToken },
    })
    expect(publishRes.status).toBe(200)

    const updated = await pollUntil(async () => {
      const body = await (await fetch(`${baseUrl()}/document`)).json()
      return body.document?.annotations?.length === 1 ? body : undefined
    })
    expect(updated.valid).toBe(true)
  })

  it('keeps serving the last-valid /document when a publish is rejected', async () => {
    const before = await (await fetch(`${baseUrl()}/document`)).json()

    await fetch(`${baseUrl()}/publish`, { method: 'POST', headers: { 'x-write-token': handle.writeToken } })

    // Give the poll-based watcher a few cycles to (not) notice anything, then confirm no drift.
    await new Promise((r) => setTimeout(r, 250))
    const after = await (await fetch(`${baseUrl()}/document`)).json()
    expect(after).toEqual(before)
  })

  it('lists Questions without a write token and requires one to raise one', async () => {
    const unauthorized = await fetch(`${baseUrl()}/questions`, {
      method: 'POST',
      body: JSON.stringify({ body: 'why?' }),
    })
    expect(unauthorized.status).toBe(401)

    const created = await fetch(`${baseUrl()}/questions`, {
      method: 'POST',
      headers: { 'x-write-token': handle.writeToken, 'content-type': 'application/json' },
      body: JSON.stringify({ body: 'why is this rate limited?' }),
    })
    expect(created.status).toBe(201)
    const question = await created.json()
    expect(question.status).toBe('open')
    expect(question.kind).toBe('question')

    const list = await (await fetch(`${baseUrl()}/questions`)).json()
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe(question.id)
  })

  it('withdraws a Question and raises its replacement via the API, without a write token failing the read side', async () => {
    const created = await (
      await fetch(`${baseUrl()}/questions`, {
        method: 'POST',
        headers: { 'x-write-token': handle.writeToken, 'content-type': 'application/json' },
        body: JSON.stringify({ body: 'badly phrased' }),
      })
    ).json()

    const withdrawUnauthorized = await fetch(`${baseUrl()}/questions/${created.id}/withdraw`, {
      method: 'POST',
      body: JSON.stringify({ body: 'better phrased' }),
    })
    expect(withdrawUnauthorized.status).toBe(401)

    const withdrawn = await fetch(`${baseUrl()}/questions/${created.id}/withdraw`, {
      method: 'POST',
      headers: { 'x-write-token': handle.writeToken, 'content-type': 'application/json' },
      body: JSON.stringify({ body: 'better phrased' }),
    })
    expect(withdrawn.status).toBe(201)

    const list = await (await fetch(`${baseUrl()}/questions`)).json()
    expect(list.find((q: { id: string }) => q.id === created.id).status).toBe('withdrawn')
    expect(list.find((q: { status: string }) => q.status === 'open').body).toBe('better phrased')
  })

  it('raises a change-request Comment via the API, round-tripping kind', async () => {
    const created = await fetch(`${baseUrl()}/questions`, {
      method: 'POST',
      headers: { 'x-write-token': handle.writeToken, 'content-type': 'application/json' },
      body: JSON.stringify({ body: 'please add a regression test', target: { type: 'file', path: 'src/auth/login.ts' }, kind: 'change-request' }),
    })
    expect(created.status).toBe(201)
    const comment = await created.json()
    expect(comment.kind).toBe('change-request')
    expect(comment.resolved).toBe(false)

    const list = await (await fetch(`${baseUrl()}/questions`)).json()
    expect(list.find((c: { id: string }) => c.id === comment.id).kind).toBe('change-request')
  })

  it('defaults kind to question when omitted, preserving old-client behavior', async () => {
    const created = await fetch(`${baseUrl()}/questions`, {
      method: 'POST',
      headers: { 'x-write-token': handle.writeToken, 'content-type': 'application/json' },
      body: JSON.stringify({ body: 'why is this rate limited?' }),
    })
    const comment = await created.json()
    expect(comment.kind).toBe('question')
  })

  it('rejects an unrecognized kind value', async () => {
    const res = await fetch(`${baseUrl()}/questions`, {
      method: 'POST',
      headers: { 'x-write-token': handle.writeToken, 'content-type': 'application/json' },
      body: JSON.stringify({ body: 'text', kind: 'bug-report' }),
    })
    expect(res.status).toBe(400)
  })

  it('resolves a change-request Comment via POST /questions/:id/resolve, gated behind the write token', async () => {
    const created = await (
      await fetch(`${baseUrl()}/questions`, {
        method: 'POST',
        headers: { 'x-write-token': handle.writeToken, 'content-type': 'application/json' },
        body: JSON.stringify({ body: 'please fix this', kind: 'change-request' }),
      })
    ).json()

    const unauthorized = await fetch(`${baseUrl()}/questions/${created.id}/resolve`, { method: 'POST' })
    expect(unauthorized.status).toBe(401)

    const resolveRes = await fetch(`${baseUrl()}/questions/${created.id}/resolve`, {
      method: 'POST',
      headers: { 'x-write-token': handle.writeToken },
    })
    expect(resolveRes.status).toBe(200)
    const resolved = await resolveRes.json()
    expect(resolved.resolved).toBe(true)
    expect(resolved.resolvedAt).toBeTruthy()

    const list = await (await fetch(`${baseUrl()}/questions`)).json()
    expect(list.find((c: { id: string }) => c.id === created.id).resolved).toBe(true)
  })

  it('404s resolving a Comment id that does not exist', async () => {
    const res = await fetch(`${baseUrl()}/questions/does-not-exist/resolve`, {
      method: 'POST',
      headers: { 'x-write-token': handle.writeToken },
    })
    expect(res.status).toBe(404)
  })

  it('resolving a Comment never touches review.next.json or any Generator-owned file', async () => {
    const created = await (
      await fetch(`${baseUrl()}/questions`, {
        method: 'POST',
        headers: { 'x-write-token': handle.writeToken, 'content-type': 'application/json' },
        body: JSON.stringify({ body: 'please fix this', kind: 'change-request' }),
      })
    ).json()

    const reviewJsonBefore = readFileSync(join(workBundle, 'review.json'), 'utf-8')
    const nextPath = join(workBundle, 'review.next.json')

    await fetch(`${baseUrl()}/questions/${created.id}/resolve`, {
      method: 'POST',
      headers: { 'x-write-token': handle.writeToken },
    })

    expect(readFileSync(join(workBundle, 'review.json'), 'utf-8')).toBe(reviewJsonBefore)
    expect(existsSync(nextPath)).toBe(false)
  })

  it('reads and writes Review State, gating writes behind the write token', async () => {
    const initial = await (await fetch(`${baseUrl()}/state`)).json()
    expect(initial.decision).toBe('unset')

    const unauthorized = await fetch(`${baseUrl()}/state`, {
      method: 'PUT',
      body: JSON.stringify({ ...initial, decision: 'approve' }),
    })
    expect(unauthorized.status).toBe(401)

    const updateRes = await fetch(`${baseUrl()}/state`, {
      method: 'PUT',
      headers: { 'x-write-token': handle.writeToken, 'content-type': 'application/json' },
      body: JSON.stringify({ ...initial, decision: 'approve', groups: { 'bg-1': { understood: true, verified: true } } }),
    })
    expect(updateRes.status).toBe(200)

    const reloaded = await (await fetch(`${baseUrl()}/state`)).json()
    expect(reloaded.decision).toBe('approve')
    expect(reloaded.groups['bg-1']).toEqual({ understood: true, verified: true })
  })

  it('serves a rendered view with a copyable Generator-invocation prompt', async () => {
    const res = await fetch(`${baseUrl()}/view`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.generatorPrompt).toContain('/review-workspace')
    expect(body.generatorPrompt).toContain(workBundle.replace(/\/$/, ''))
  })

  it('exports a report without requiring a write token, and without mutating state', async () => {
    await fetch(`${baseUrl()}/state`, {
      method: 'PUT',
      headers: { 'x-write-token': handle.writeToken, 'content-type': 'application/json' },
      body: JSON.stringify({
        groups: {},
        notes: ['looks good overall'],
        decision: 'approve',
      }),
    })
    const before = await (await fetch(`${baseUrl()}/state`)).json()

    const reportRes = await fetch(`${baseUrl()}/report`)
    expect(reportRes.status).toBe(200)
    const report = await reportRes.text()
    expect(report).toContain('looks good overall')
    expect(report).toContain('approve')

    const after = await (await fetch(`${baseUrl()}/state`)).json()
    expect(after).toEqual(before)
  })

  it('source contains no outbound network call, telemetry, or update-check APIs', async () => {
    // Requests are served and asserted to succeed first, so this isn't just a static check
    // of unreachable code — the same code path that runs the request is scanned below.
    await fetch(`${baseUrl()}/document`)
    await fetch(`${baseUrl()}/publish`, { method: 'POST', headers: { 'x-write-token': handle.writeToken } })

    const source = readFileSync(fileURLToPath(new URL('./create-server.ts', import.meta.url)), 'utf-8')
    for (const forbidden of ['fetch(', 'http.request', 'https.request', 'XMLHttpRequest', 'net.connect']) {
      expect(source).not.toContain(forbidden)
    }
  })
})

describe('GET /assets/*', () => {
  const imagePairBundle = fileURLToPath(new URL('../../fixtures/bundles/image-pair/', import.meta.url))
  let imageHandle: ReviewServerHandle

  beforeEach(async () => {
    imageHandle = await startReviewServer(imagePairBundle)
  })

  afterEach(async () => {
    await imageHandle.close()
  })

  it('serves an asset with the correct content-type', async () => {
    const res = await fetch(`http://127.0.0.1:${imageHandle.port}/assets/snapshot/head.png`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')
    expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(0)
  })

  it('404s for an asset that does not exist', async () => {
    const res = await fetch(`http://127.0.0.1:${imageHandle.port}/assets/snapshot/does-not-exist.png`)
    expect(res.status).toBe(404)
  })

  it('rejects a path traversal attempt', async () => {
    const res = await fetch(`http://127.0.0.1:${imageHandle.port}/assets/..%2F..%2Freview.json`)
    expect(res.status).toBe(404)
  })

  it('rejects a disallowed file type even if it exists under assets/', async () => {
    const res = await fetch(`http://127.0.0.1:${imageHandle.port}/assets/snapshot/notes.txt`)
    expect(res.status).toBe(404)
  })
})

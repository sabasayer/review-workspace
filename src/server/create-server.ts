import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { randomBytes } from 'node:crypto'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { validateBundle, type ValidateBundleResult } from '../bundle/validate-bundle.ts'
import { publishBundle } from '../bundle/publish.ts'
import { watchBundle } from './watch-bundle.ts'
import { raiseQuestion, readQuestions, resolveComment, withdrawAndReplaceQuestion } from '../questions/questions-log.ts'
import type { CommentKind } from '../questions/types.ts'
import { readReviewState, writeReviewState } from '../review-state/review-state.ts'
import type { ReviewState } from '../review-state/types.ts'
import { render } from '../renderer/render.ts'
import type { ReviewDocument } from '../schema/types.ts'
import { buildReport } from '../export/report.ts'
import { resolveAssetPath } from '../security/asset-path.ts'

export interface ReviewServerHandle {
  server: Server
  writeToken: string
  port: number
  close: () => Promise<void>
}

export interface ReviewServerOptions {
  port?: number
  writeToken?: string
}

export function generateWriteToken(): string {
  return randomBytes(24).toString('hex')
}

const WRITE_TOKEN_HEADER = 'x-write-token'
const WITHDRAW_PATH = /^\/questions\/([^/]+)\/withdraw$/
const RESOLVE_PATH = /^\/questions\/([^/]+)\/resolve$/
const COMMENT_KINDS: CommentKind[] = ['question', 'change-request']
const ASSET_CONTENT_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
}

// `pnpm build:ui` copies the built Vite app here (sibling of src/) so a published
// package can serve the UI itself — `npx review-workspace serve` with no separate
// `cd ui && pnpm dev` step. Absent when running from source (dev uses Vite's own
// dev server + proxy instead), so every lookup below treats a missing dir as "not built".
const UI_DIST_DIR = join(import.meta.dirname, '..', '..', 'ui-dist')
const UI_CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  ...ASSET_CONTENT_TYPES,
}

function serveUiStatic(pathname: string, res: ServerResponse): boolean {
  if (!existsSync(UI_DIST_DIR)) return false

  // SPA fallback: any path without a recognized static-file extension is a client-side
  // route (e.g. a deep link) — serve index.html and let the app's own router take over.
  const hasExtension = /\.[a-zA-Z0-9]+$/.test(pathname)
  const candidate = join(UI_DIST_DIR, hasExtension ? pathname : 'index.html')
  const resolved = hasExtension && existsSync(candidate) && statSync(candidate).isFile() ? candidate : join(UI_DIST_DIR, 'index.html')

  if (!existsSync(resolved)) return false
  const ext = resolved.slice(resolved.lastIndexOf('.')).toLowerCase()
  res.writeHead(200, { 'content-type': UI_CONTENT_TYPES[ext] ?? 'application/octet-stream' })
  createReadStream(resolved).pipe(res)
  return true
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
    })
    req.on('end', () => {
      try {
        resolve(raw.trim() === '' ? {} : JSON.parse(raw))
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

export function startReviewServer(bundlePath: string, opts: ReviewServerOptions = {}): Promise<ReviewServerHandle> {
  const writeToken = opts.writeToken ?? generateWriteToken()

  // The served document is cached and only refreshed by the watcher below, so a
  // publish must actually trigger re-validation for /document to ever change —
  // this is what makes file watching load-bearing rather than a no-op wrapper
  // around a stateless re-read-per-request design.
  let latest: ValidateBundleResult = validateBundle(bundlePath)
  const watcher = watchBundle(bundlePath)
  watcher.emitter.on('change', () => {
    latest = validateBundle(bundlePath)
  })

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    // The dev-mode Vite proxy strips this same prefix before forwarding here; a bundled
    // production build talks to this one server directly, so both shapes must resolve
    // to the same routes below.
    if (url.pathname.startsWith('/api/')) url.pathname = url.pathname.slice('/api'.length)
    const respond = (status: number, body: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json' })
      res.end(JSON.stringify(body))
    }

    if (req.method === 'GET' && url.pathname === '/document') {
      respond(200, latest)
      return
    }

    if (req.method === 'GET' && url.pathname === '/view') {
      if (!latest.valid) {
        respond(422, { error: 'bundle is not valid', blockingReason: latest.blockingReason })
        return
      }
      respond(200, render(latest.document as ReviewDocument, latest.patch!, latest.diagnostics ?? [], bundlePath))
      return
    }

    if (req.method === 'GET' && url.pathname === '/questions') {
      respond(200, readQuestions(bundlePath))
      return
    }

    if (req.method === 'GET' && url.pathname === '/state') {
      respond(200, readReviewState(bundlePath))
      return
    }

    if (req.method === 'GET' && url.pathname === '/report') {
      if (!latest.valid) {
        respond(422, { error: 'bundle is not valid', blockingReason: latest.blockingReason })
        return
      }
      res.writeHead(200, { 'content-type': 'text/markdown' })
      res.end(buildReport(latest.document as ReviewDocument, readReviewState(bundlePath)))
      return
    }

    if (req.method === 'GET' && url.pathname.startsWith('/assets/')) {
      const assetPath = decodeURIComponent(url.pathname.slice('/assets/'.length))
      const resolution = resolveAssetPath(bundlePath, assetPath)
      if (!resolution.ok || !existsSync(resolution.absolutePath) || !statSync(resolution.absolutePath).isFile()) {
        respond(404, { error: 'asset not found' })
        return
      }
      const ext = assetPath.slice(assetPath.lastIndexOf('.')).toLowerCase()
      res.writeHead(200, { 'content-type': ASSET_CONTENT_TYPES[ext] ?? 'application/octet-stream' })
      createReadStream(resolution.absolutePath).pipe(res)
      return
    }

    if (req.method !== 'GET') {
      if (req.headers[WRITE_TOKEN_HEADER] !== writeToken) {
        respond(401, { error: 'invalid write token' })
        return
      }
    }

    if (req.method === 'POST' && url.pathname === '/publish') {
      const result = publishBundle(bundlePath)
      respond(result.ok ? 200 : 422, result)
      return
    }

    if (req.method === 'POST' && url.pathname === '/questions') {
      readJsonBody(req)
        .then((body) => {
          const { body: text, target, kind } = body as { body?: string; target?: unknown; kind?: unknown }
          if (typeof text !== 'string' || text.trim() === '') {
            respond(400, { error: 'body is required' })
            return
          }
          if (kind !== undefined && !COMMENT_KINDS.includes(kind as CommentKind)) {
            respond(400, { error: `kind must be one of ${COMMENT_KINDS.join(', ')}` })
            return
          }
          respond(201, raiseQuestion(bundlePath, text, target as never, (kind as CommentKind) ?? 'question'))
        })
        .catch(() => respond(400, { error: 'invalid JSON body' }))
      return
    }

    const withdrawMatch = WITHDRAW_PATH.exec(url.pathname)
    if (req.method === 'POST' && withdrawMatch) {
      readJsonBody(req)
        .then((body) => {
          const { body: text, target } = body as { body?: string; target?: unknown }
          if (typeof text !== 'string' || text.trim() === '') {
            respond(400, { error: 'body is required for the replacement Question' })
            return
          }
          respond(201, withdrawAndReplaceQuestion(bundlePath, withdrawMatch[1], text, target as never))
        })
        .catch(() => respond(400, { error: 'invalid JSON body' }))
      return
    }

    // Human-only action: a Reviewer marking a change-request Comment resolved. This
    // never reads from or writes to `review.next.json`/the Generator-owned Review
    // Document — the Generator has no path to setting `resolved` (see ADR 0002).
    const resolveMatch = RESOLVE_PATH.exec(url.pathname)
    if (req.method === 'POST' && resolveMatch) {
      const result = resolveComment(bundlePath, resolveMatch[1])
      if (result.outcome === 'not-found') {
        respond(404, { error: 'no such Comment' })
        return
      }
      if (result.outcome === 'not-resolvable') {
        respond(400, { error: 'Comment is not an open change-request' })
        return
      }
      respond(200, result.comment)
      return
    }

    if (req.method === 'PUT' && url.pathname === '/state') {
      readJsonBody(req)
        .then((body) => {
          writeReviewState(bundlePath, body as ReviewState)
          respond(200, body)
        })
        .catch(() => respond(400, { error: 'invalid JSON body' }))
      return
    }

    if (req.method === 'GET' && serveUiStatic(url.pathname, res)) return

    respond(404, { error: 'not found' })
  })

  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(opts.port ?? 0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address !== null ? address.port : 0
      resolve({
        server,
        writeToken,
        port,
        close: () =>
          new Promise((res) => {
            watcher.stop()
            server.close(() => res())
          }),
      })
    })
  })
}

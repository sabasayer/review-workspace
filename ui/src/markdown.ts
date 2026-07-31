import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { assetUrl } from './api.ts'

// GitLab MR descriptions reference uploads as repo-relative paths (e.g. `/uploads/<hash>/file.png`).
// A cross-origin <img> to gitlab.com gets blocked by ORB (no session cookie flows to a subresource
// request, so GitLab serves a login redirect with a mismatched content-type). The Generator fetches
// referenced uploads into the bundle's assets/uploads/... (mirroring the same relative path) — if
// present there, serve it same-origin through the loopback server instead of hitting GitLab directly.
function resolveRelativeImages(html: string, mrUrl: string | undefined): string {
  html = html.replace(/(<img[^>]+src=")\/uploads\//g, `$1${assetUrl('uploads/')}`)
  if (!mrUrl) return html
  let origin: string
  try {
    origin = new URL(mrUrl).origin
  } catch {
    return html
  }
  return html.replace(/(<img[^>]+src=")\/(?!\/)/g, `$1${origin}/`)
}

export function renderMarkdown(source: string, mrUrl?: string): string {
  const html = marked.parse(source, { async: false, breaks: true })
  return DOMPurify.sanitize(resolveRelativeImages(html, mrUrl))
}

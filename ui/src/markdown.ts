import { Marked } from 'marked'
import DOMPurify from 'dompurify'
import { assetUrl } from './api.ts'
import { currentFiles } from './composables/view-model-store.ts'
import { looksLikePath, resolveFileRef } from './file-refs.ts'

function escapeAttribute(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

const markdown = new Marked({
  renderer: {
    codespan({ text }) {
      const name = text.replace(/&#39;/g, "'")
      if (!looksLikePath(name)) return false
      const ref = resolveFileRef(name, currentFiles.value.map((f) => f.path))
      if (ref.kind === 'ambiguous') return false
      return `<code class="file-ref file-ref-${ref.kind}" data-file-ref="${escapeAttribute(name)}" tabindex="0">${text}</code>`
    },
  },
})

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
  const html = markdown.parse(source, { async: false, breaks: true })
  return DOMPurify.sanitize(resolveRelativeImages(html, mrUrl))
}

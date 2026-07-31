const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/** Disables raw HTML in Markdown-bearing text by escaping it to literal characters. */
export function escapeRawHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ESCAPES[char])
}

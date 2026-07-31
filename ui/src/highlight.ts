// Lightweight, dependency-free token highlighter — adapted from the discovery
// prototype's highlightCode(). Diff lines are shown out of full-file context, so a
// real language server/grammar is overkill; a regex tokenizer covering comments,
// strings, numbers, keywords, types, function calls, and properties is what the
// prototype already validated as "good enough" for a diff view.
const KEYWORDS = new Set([
  'as', 'async', 'await', 'break', 'case', 'catch', 'class', 'const',
  'continue', 'default', 'delete', 'do', 'else', 'export', 'extends',
  'false', 'finally', 'for', 'from', 'function', 'if', 'implements',
  'import', 'in', 'interface', 'keyof', 'let', 'new', 'null', 'of',
  'readonly', 'return', 'switch', 'throw', 'true', 'try', 'type',
  'typeof', 'undefined', 'var', 'while',
])

// Arbitrary-value classes referencing the --syntax-* custom properties defined in
// main.css (ported 1:1 from the discovery prototype's own light/dark palettes) — the
// light/dark swap happens via the CSS variable's .dark override, not a `dark:` variant
// per class, so these colors track the prototype exactly rather than a Tailwind approximation.
const TOKEN_CLASSES = {
  comment: 'italic text-[var(--syntax-comment)]',
  keyword: 'font-semibold text-[var(--syntax-keyword)]',
  string: 'text-[var(--syntax-string)]',
  number: 'text-[var(--syntax-number)]',
  function: 'text-[var(--syntax-function)]',
  type: 'text-[var(--syntax-type)]',
  property: 'text-[var(--syntax-property)]',
  operator: 'text-[var(--syntax-operator)]',
} as const

const TOKEN_PATTERN =
  /(\/\/.*|\/\*.*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b\d+(?:\.\d+)?\b|[A-Za-z_$][\w$]*|\s+|.)/g

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ESCAPES[c])
}

export function highlightCode(source: string): string {
  const code = String(source)
  let html = ''
  for (const match of code.matchAll(TOKEN_PATTERN)) {
    const token = match[0]
    const start = match.index ?? 0
    const before = code.slice(0, start).trimEnd().at(-1)
    const after = code.slice(start + token.length).trimStart().at(0)
    let kind: keyof typeof TOKEN_CLASSES | '' = ''
    if (token.startsWith('//') || token.startsWith('/*')) kind = 'comment'
    else if (/^["'`]/.test(token)) kind = 'string'
    else if (/^\d/.test(token)) kind = 'number'
    else if (KEYWORDS.has(token)) kind = 'keyword'
    else if (/^[A-Z][A-Za-z0-9_$]*$/.test(token)) kind = 'type'
    else if (/^[A-Za-z_$]/.test(token) && after === '(') kind = 'function'
    else if (/^[A-Za-z_$]/.test(token) && (before === '.' || after === ':')) kind = 'property'
    else if (/^[{}[\]().,:;?=><!&|+\-*/]+$/.test(token)) kind = 'operator'
    const escaped = escapeHtml(token)
    html += kind ? `<span class="${TOKEN_CLASSES[kind]}">${escaped}</span>` : escaped
  }
  return html
}

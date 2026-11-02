import { describe, expect, it } from 'vitest'
import { renderMarkdown } from './markdown.ts'
import { currentFiles } from './composables/view-model-store.ts'
import type { RenderedFile } from './types.ts'

describe('renderMarkdown', () => {
  it('renders markdown to sanitized HTML', () => {
    const html = renderMarkdown('**bold** text')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).not.toContain('<script')
  })

  it('rewrites GitLab upload paths to same-origin assets', () => {
    const html = renderMarkdown('![logo](/uploads/abc/logo.png)')
    expect(html).toContain('src="/api/assets/uploads/abc/logo.png"')
  })

  it('rewrites other relative image paths when an MR URL is provided', () => {
    const html = renderMarkdown('![shot](/files/1.png)', 'https://gitlab.example.com/group/project')
    expect(html).toContain('src="https://gitlab.example.com/files/1.png"')
  })
})

describe('renderMarkdown file references', () => {
  const changed = (...paths: string[]) => {
    currentFiles.value = paths.map((path) => ({ path }) as RenderedFile)
  }

  it('marks a code span that names a changed file', () => {
    changed('utils/connector-management/repos.ts')
    const html = renderMarkdown('See `repos.ts` here')
    expect(html).toContain('data-file-ref="repos.ts"')
    expect(html).toContain('tabindex="0"')
    expect(html).toContain('file-ref-diff')
  })

  it('marks a path outside the diff as a file reference too', () => {
    changed('a.ts')
    const html = renderMarkdown('Read `nuxt.config.ts`')
    expect(html).toContain('data-file-ref="nuxt.config.ts"')
    expect(html).toContain('file-ref-outside')
  })

  it('leaves an ambiguous name and a plain code span alone', () => {
    changed('a/index.ts', 'b/index.ts')
    const html = renderMarkdown('`index.ts` and `MAX_ATTEMPTS`')
    expect(html).not.toContain('data-file-ref')
    expect(html).toContain('<code>MAX_ATTEMPTS</code>')
  })

  it('leaves fenced code blocks alone', () => {
    changed('a.ts')
    expect(renderMarkdown('```\na.ts\n```')).not.toContain('data-file-ref')
  })

  it('does not let a code span inject markup', () => {
    changed('a.ts')
    const html = renderMarkdown('`<img src=x onerror=alert(1)>.ts`')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('data-file-ref')
  })
})

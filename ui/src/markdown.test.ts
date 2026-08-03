import { describe, expect, it } from 'vitest'
import { renderMarkdown } from './markdown.ts'

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

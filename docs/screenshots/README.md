# Doc screenshots

Playwright e2e tests write screenshots here. Use stable, descriptive filenames:

| File | Feature |
|------|---------|
| `diff-review-inline.png` | Inline diff with behavioral groups |
| `diff-review-side-by-side.png` | Side-by-side diff layout |
| `annotation-note-popover.png` | Annotation badge popover with related-target link |
| `annotation-related-code-preview.png` | Inline code preview on related-target hover |
| `questions-panel.png` | Questions slideover |
| `mr-details.png` | MR metadata slideover |
| `image-compare-side-by-side.png` | Image evidence side-by-side compare |
| `change-request-open.png` | An open change-request Comment, visually distinct from a Question |
| `change-request-resolved-collapsed.png` | A resolved change-request Comment, collapsed by default in the Questions panel |

- Source bundles: synthetic fixtures only (`fixtures/bundles/`).
- Referenced from [`index.html`](../index.html) on the landing page.
- Regenerate when the UI they depict changes.

See [`development.md`](../development.md#screenshots-for-docs).

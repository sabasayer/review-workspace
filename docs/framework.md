# Review Workspace Framework

Durable product rules for creating, rendering, and improving Review Bundles.

## Product thesis

Review Workspace turns a flat file diff into an evidence-linked map of intent, behavior, risk, and observable effects. It helps an experienced maintainer reach a defensible decision without moving among a forge, issue tracker, IDE, pipeline UI, and preview.

The product is a decision surface, not an AI report. Code remains primary; interpretation stays attached to the evidence it explains.

## Product boundary

Review Workspace owns:

- The Review Bundle contract and schemas
- Bundle validation and Unified Patch parsing
- Deterministic rendering
- Reviewer Questions and Review State
- Local file watching and atomic publishing
- Report and concern-comment export

Review Workspace does not own:

- Bundle generation
- AI or model access
- Git, GitHub, or GitLab access
- Live application orchestration
- Review submission or approval
- Multi-reviewer collaboration

## Canonical bundle

```text
review-bundle/
  review.json
  review.next.json
  changes.diff
  questions.jsonl
  state.json
  assets/
```

- `review.json` is the last valid Generator-owned Review Document.
- `review.next.json` is a staged Generator update consumed by atomic publishing.
- `changes.diff` is the immutable authoritative Unified Patch.
- `questions.jsonl` is the app-owned append-only Question inbox.
- `state.json` is the app-owned single-Reviewer state.
- `assets/` contains local evidence referenced by relative path.

One bundle represents one exact base/head Comparison. New commits require a new bundle.

## Non-negotiable review behavior

1. Show every changed file and every hunk. Summaries never replace the complete diff.
2. Order files by Behavioral Group, dependency, risk, and comprehension rather than alphabetically.
3. Keep intent, risk, tests, pipeline results, media, and cross-file relationships beside relevant code.
4. Distinguish observed Evidence, author claims, Generator inference, and Reviewer judgment.
5. Keep code primary through progressive disclosure and collapsible secondary panels.
6. Preserve one logical code line per visual row. Long lines scroll horizontally.
7. Support inline and side-by-side code layouts with identical content.
8. Render image evidence with side-by-side, swipe, onion-skin, and changed-pixel modes.
9. Track understanding separately from verification.
10. Persist Reviewer progress, concerns, notes, and decision in the bundle.

## Semantic Review Document

The Review Document describes concepts, never components or layout. Its core collections are:

- Behavioral Groups
- Annotations
- Evidence
- Verification items and gaps
- Answers

The document requires an integer `schemaVersion` and exact Comparison identity. A minimally enriched document is valid; missing optional interpretation falls back to the complete patch in patch order.

## Targets

Annotations, Questions, Answers, and comments use typed Targets:

- File
- Hunk
- Line with side and line number
- Binary change

Line Targets carry expected text so the validator can detect stale or incorrect references. Unresolved Targets produce visible Diagnostics.

## Questions and answers

Questions are immutable append-only records. Corrections withdraw a Question and create a replacement. One Answer addresses exactly one Question; follow-ups are new Questions that may reference a prior Question.

The app never launches a Generator. It provides a copyable prompt telling the Reviewer to invoke the `/review-workspace` skill with the absolute bundle path.

## Validation behavior

Block opening only when:

- JSON cannot be parsed
- The schema version is unsupported
- Comparison identity is missing
- The Unified Patch cannot be used

Render valid content and show Diagnostics when optional records, Targets, or assets fail.

Generator updates follow validate-then-atomic-publish:

1. Write `review.next.json`.
2. Run `review-workspace publish <bundle>`.
3. Validate schema and Targets.
4. Atomically replace `review.json`.

The UI retains the last valid Review Document during invalid or incomplete updates.

## Security and privacy

Treat every bundle as untrusted:

- Disable raw HTML in Markdown.
- Constrain assets to the bundle's `assets/` directory.
- Render only approved local media types.
- Enforce configurable document, patch, line, and asset limits.
- Bind the server to loopback.
- Require a per-session token for writes.
- Never fetch external URLs automatically.
- Emit no telemetry or implicit network requests.

## Performance and accessibility

- Parse the complete patch without truncation.
- Target 100 files and 20,000 patch lines.
- Make the initial workspace ready within two seconds on a typical developer laptop.
- Virtualize rendering while preserving scroll, search, Targets, and complete-diff semantics.
- Meet WCAG 2.2 AA across keyboard, screen-reader, contrast, reduced-motion, and non-color diff cues.

## Feedback loop

Classify each feedback item:

- **Artifact-specific**: fix implementation and add a regression test.
- **Durable product learning**: update this framework, implementation, and regression coverage in the same change.

Every fix must preserve source file/hunk counts, both diff layouts, Target resolution, responsive behavior, persistence, and a clean browser console.

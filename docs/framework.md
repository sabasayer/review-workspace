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
  live-head.json
  assets/
```

- `review.json` is the last valid Generator-owned Review Document.
- `review.next.json` is a staged Generator update consumed by atomic publishing.
- `changes.diff` is the immutable authoritative Unified Patch.
- `questions.jsonl` is the app-owned append-only Question inbox.
- `state.json` is the app-owned single-Reviewer state.
- `watcher.json` is optional. The watcher writes `{ enabled, cap, used, current, updatedAt }`. `updatedAt` is an ISO date-time. It is the heartbeat (a time stamp the watcher renews on each tick). The watcher writes it every 3 s. The UI marks the watcher as stopped when `updatedAt` is over 30 s old. While `current` holds a Question id, the limit is 5 min, because one answer can take minutes. A file with no `updatedAt` never counts as stopped. The engine only reads it.
- `live-head.json` is optional. The Generator writes `{ head, checkedAt }` with the newest commit of the MR. The engine only reads it. See [ADR 0005](adr/0005-note-fields-general-target-proof-links-live-head.md).
- `assets/` contains local evidence referenced by relative path.
- Backup: `publish` and `serve` make a copy of the bundle. Each rule below is separate.
  - Place: the copy goes to `~/.claude/review-workspace-backups/<bundle-name>-<hash>/`. Set `REVIEW_WORKSPACE_BACKUP_ROOT` to use another folder.
  - Time: `publish` and `serve` make a copy at start. The server makes a new copy after each write request that succeeds.
  - Kept: only the latest copy is kept.
  - Left out: `.write-token` and `watcher.json` are not copied. No copy is made when `review.json` is missing.
  - Gone: if the bundle folder is gone, every API route answers `503` with the backup path.

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
- Summary (optional)

The document requires an integer `schemaVersion` and exact Comparison identity. A minimally enriched document is valid; missing optional interpretation falls back to the complete patch in patch order.

An optional Summary is a short, top-of-page orientation: brief text plus pointers (`highlightAnnotationIds`, `highlightPaths`) at the Annotations and files most worth reading first. It only points at Targets and Annotations that already exist elsewhere in the document — it never introduces new claims of its own. A dangling id or path is dropped silently, the same treatment as any other cross-reference in the document.

## Targets

Annotations, Questions, Answers, and comments use typed Targets:

- File
- Hunk
- Line with side and line number
- Binary change
- General (the whole Comparison, for an Annotation with no code line, or a Comment about the whole change)

Line Targets carry expected text so the validator can detect stale or incorrect references. Unresolved Targets produce visible Diagnostics.

A Verification item has no Target of its own — only `targetIds` naming an Annotation, an Evidence item, or a file path. When a `gap` item's `targetIds` are empty or resolve to nothing concrete (unset `diffuse`), the validator emits an `unanchored-verification-gap` Diagnostic rather than letting it render as a dead-end link.

## Questions and answers

Questions are immutable append-only records. Corrections withdraw a Question and create a replacement. One Answer addresses exactly one Question; follow-ups are new Questions that may reference a prior Question.

A Comment may use the general Target. It is never stale and has no Resolution status. Only the Reviewer marks it fixed. An open general change-request carries forward to the next round. The hand-off export lists it under "General". The skill never posts it inline. It posts a general MR comment only after the Reviewer says "send" and agrees to a general comment. See [ADR 0006](adr/0006-general-target-for-comments.md).

### Question panel

A docked side panel replaces the Question popover. It holds every Comment as one thread, newest first.

- The panel has two tabs: Questions and Change-requests. The composer kind follows the active tab. The nav badge counts Questions only.

- A Question shows its state in words and an icon: waiting (nobody picked it up), answering (the watcher works on it) or answered (an Answer exists). A change-request has no agent state.
- The watcher writes `current` (the id of the Question it works on, or `null`) into `watcher.json`. The UI reads it through `GET /watcher`.
- A click on a Question marker, or on "Ask a question", opens the panel on that thread. The panel stays open after the Reviewer sends a Question.
- A composer at the bottom asks the next Question. Its Target chooser starts at the Target of the open thread.
- The panel scrolls inside itself and fits any window.
- A new Answer gives a toast. It also makes the badge on the panel button bigger: text of at least 14px, contrast of at least 4.5:1, and a count with the word "new" for screen readers. The badge clears when the Reviewer opens the thread.
- When live answers are off, a waiting Question shows "Send to agent".

### Suggestion buttons

Every finding, and every note, has two buttons. "Raise as change-request" opens the change-request box with the suggestion text. "Ask a question" opens the panel composer for that Target. For a finding about the whole change, the Target is general.

The app never launches a Generator. It provides a copyable prompt telling the Reviewer to invoke the `/review-workspace` skill with the absolute bundle path.

### Preview and jump

A file name in a note or finding becomes a link-like element. This holds for a markdown code span such as `repos.ts` or `utils/connector-management/repos.ts`.

- A code span counts as a file name when it has a "/" or a file extension.
- The name matches a changed file by full path. If that fails, it matches by unique path suffix. When several changed files match, the name stays plain text.
- Hover or keyboard focus shows a Preview. A file in the diff shows its first 12 patch lines. A file outside the diff shows its first 40 lines, read from the repo.
- A file that cannot be read shows no Preview. The same holds for every file when the server runs without `--repo`.
- Ctrl+click (Cmd+click on macOS) jumps to the file in the diff and highlights it for a short time. A plain click does nothing new.
- A file outside the diff has no jump. Its Preview says that it is not in the diff.
- Escape closes the Preview. The Preview stays open while the pointer is over it.
- The Preview is not the only way to the facts. Every changed file is also in the diff.
- A note or finding with a line or hunk Target has a jump button in its header. It scrolls to the Target in the diff.
- The engine serves `GET /repo-file?path=<relative>&lines=40` only when started with `--repo`. It needs no write token. The next section lists the safety rules.

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
- Serve repo files only through `GET /repo-file`, and only with `--repo`. Refuse absolute paths and `..`. Resolve the real path, and refuse any file outside the repo root, also through symlinks. Refuse directories, binary files and files over 256 KB. Answer 404 with a clear error for every refusal.
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

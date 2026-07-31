# Review Workspace — v1 Spec

**Status:** ready-for-agent

## Problem Statement

An experienced maintainer reviewing a non-trivial change has to reconstruct intent, behavior, and risk by hopping between a forge diff view, an issue tracker, an IDE, a pipeline UI, and a preview environment. Flat diffs show *what* changed but not *why*, what it *does*, or what's *risky*, and any AI-generated summary of a change lives disconnected from the code it describes — so the reviewer either re-derives context by hand or has to trust an unlinked narrative.

## Solution

Review Workspace is a local, offline decision surface that opens one immutable Comparison (a base/head diff) as a Review Bundle: the complete Unified Patch plus a Generator-produced Review Document that attaches Evidence, Annotations, and Behavioral Groups directly to Targets in the diff. The Reviewer reads real code first, always, with interpretation staying visibly attached to the evidence it explains rather than replacing it. The Reviewer can raise Questions against any Target, track understanding and verification separately, and persist their Review State (progress, concerns, notes, decision) locally — all without the app itself ever calling an AI, a forge, or the network.

## User Stories

1. As a Reviewer, I want to open a Review Bundle by absolute path, so that I can start reviewing without configuring a server or account.
2. As a Reviewer, I want every changed file and every hunk shown, so that I never have to trust a summary in place of the actual diff.
3. As a Reviewer, I want files ordered by Behavioral Group, dependency, risk, and comprehension rather than alphabetically, so that related changes read in a sensible sequence.
4. As a Reviewer, I want intent, risk, tests, pipeline results, and cross-file relationships shown beside the relevant code, so that I don't have to leave the diff to find context.
5. As a Reviewer, I want Evidence, author claims, Generator inference, and my own judgment visually distinguished, so that I never mistake an AI inference for an observed fact.
6. As a Reviewer, I want progressive disclosure of secondary panels, so that code stays the primary thing on screen.
7. As a Reviewer, I want one logical code line per visual row with horizontal scroll for long lines, so that line-by-line reasoning and line numbers stay trustworthy.
8. As a Reviewer, I want both inline and side-by-side diff layouts showing identical content, so that I can switch layout without losing information.
9. As a Reviewer, I want image evidence rendered with side-by-side, swipe, onion-skin, and changed-pixel modes, so that I can verify visual changes without leaving the workspace.
10. As a Reviewer, I want understanding and verification tracked as separate states per Behavioral Group, so that "I read this" and "I confirmed this is correct" aren't conflated.
11. As a Reviewer, I want my progress, concerns, notes, and decision persisted in the bundle, so that I can close the workspace and resume later without losing state.
12. As a Reviewer, I want to raise a Question attached to a specific Target, so that I can ask for clarification on exactly the line, hunk, file, or binary change I'm unsure about.
13. As a Reviewer, I want Questions to be immutable and append-only, so that the history of what I asked is never silently rewritten.
14. As a Reviewer, I want to withdraw and replace a Question when I phrased it wrong, so that corrections don't masquerade as edits to the original record.
15. As a Reviewer, I want each Answer to address exactly one Question and cite evidence references where applicable, so that answers stay traceable to a specific ask.
16. As a Reviewer, I want a copyable prompt that tells me to invoke the Generator's skill with the bundle's absolute path, so that I can get an updated Review Document without the app calling an AI on my behalf.
17. As a Reviewer, I want the app to reject opening a bundle only when the document is unparseable, the schema version is unsupported, the Comparison identity is missing, or the Unified Patch is unusable, so that everything else renders with visible Diagnostics instead of a blank error screen.
18. As a Reviewer, I want unresolved Targets (stale line references, missing assets) to show as visible Diagnostics rather than fail silently, so that I know when interpretation has drifted from the code.
19. As a Reviewer, I want Generator updates to go through validate-then-atomic-publish (write `review.next.json`, run `publish`, validate, atomically replace `review.json`), so that a bad or partial update never corrupts my last-known-good Review Document.
20. As a Reviewer, I want the UI to keep showing the last valid Review Document while an update is invalid or incomplete, so that a broken update never blanks my view mid-review.
21. As a Reviewer, I want the app to run entirely on loopback with no telemetry, update checks, or automatic external fetches, so that source code and review data never leave my machine.
22. As a Reviewer, I want writes to require a per-session token, so that another local process can't silently mutate my Review State or Questions.
23. As a Reviewer, I want Markdown in the bundle rendered with raw HTML disabled and assets constrained to the bundle's `assets/` directory, so that an untrusted or AI-generated bundle can't inject arbitrary HTML or read files outside the bundle.
24. As a Reviewer, I want configurable limits on document size, patch size, line count, and asset size, so that a malformed or oversized bundle can't hang or crash the workspace.
25. As a Reviewer, I want a bundle with 100 files and 20,000 patch lines to open within two seconds on a typical developer laptop, so that the workspace stays usable on realistic large changes.
26. As a Reviewer, I want rendering virtualized without losing scroll position, search, Target resolution, or complete-diff semantics, so that performance work never silently drops content.
27. As a Reviewer, I want the workspace to meet WCAG 2.2 AA — keyboard navigation, screen-reader labeling, contrast, reduced motion, and non-color diff cues, so that the tool is usable regardless of ability or input device.
28. As a Reviewer, I want to export a report or concern-comments from my Review State, so that I can share my findings outside the workspace (e.g. paste into an MR).
29. As a maintainer of the Review Workspace project, I want the engine, schemas, skill, and docs published under MIT with only synthetic fixtures in the public repo, so that real Review Bundles containing proprietary code or notes never ship publicly by accident.
30. As a Generator author, I want a stable, versioned Review Document schema independent of any UI framework, so that I can produce valid bundles without coupling to the renderer's internals.
31. As a Reviewer, I want a new Comparison (new commits) to require a new bundle rather than mutating Targets in place, so that Target line references never silently point at the wrong code.

## Implementation Decisions

- **Bundle contract**: a bundle is a directory containing `review.json` (last valid Review Document), `review.next.json` (staged Generator update), `changes.diff` (immutable Unified Patch), `questions.jsonl` (append-only Question inbox), `state.json` (Review State), and `assets/` (evidence referenced by relative path). One bundle = one exact base/head Comparison.
- **Ownership split**: the Generator owns `review.json`/`review.next.json` content; the app owns `questions.jsonl` and `state.json`; `changes.diff` is immutable and never rewritten by either party (per ADR 0002).
- **Schema**: `review.json` requires an integer `schemaVersion` and exact Comparison identity (base/head revision references). Core collections: Behavioral Groups, Annotations, Evidence, Verification items and gaps, Answers. A minimally enriched document (Comparison identity + empty collections) is valid; missing optional interpretation falls back to the complete patch in patch order.
- **Targets**: typed references used by Annotations, Questions, Answers, and comments — File, Hunk, Line (with side and line number, carrying expected text for staleness detection), or Binary change. Unresolved Targets render as visible Diagnostics, never silent drops.
- **Validation gate**: block opening only on unparseable JSON, unsupported schema version, missing Comparison identity, or an unusable Unified Patch. Every other problem (bad Target, missing asset, invalid optional field) renders as a Diagnostic alongside otherwise-valid content.
- **Publish flow**: Generator writes `review.next.json` → runs `review-workspace publish <bundle>` → engine validates schema and Targets → atomically replaces `review.json` on success. On failure, `review.json` is untouched and the UI keeps showing the last valid document.
- **Rendering**: deterministic, framework-agnostic renderer driven purely by `review.json` + `changes.diff` + `state.json` + `questions.jsonl` — no hidden client state that isn't derivable from the bundle. Files ordered by Behavioral Group, dependency, risk, comprehension (never alphabetical by default). Both inline and side-by-side layouts render identical underlying content. Virtualized rendering preserves scroll position, search, Target resolution, and complete-diff semantics (per framework.md perf rules).
- **Image evidence**: side-by-side, swipe, onion-skin, and changed-pixel comparison modes for visual assets in `assets/`.
- **Local server**: loopback-bound only; per-session write token required for any mutating request (Questions, Review State); no outbound network calls, no telemetry, no update checks (per ADR 0003).
- **Generator invocation boundary**: the app never launches a Generator process. It surfaces a copyable prompt instructing the Reviewer to invoke the `/review-workspace` skill with the bundle's absolute path (per framework.md).
- **Security**: Markdown rendering disables raw HTML; asset resolution is constrained to paths under the bundle's `assets/` directory (no traversal); only an approved allowlist of local media types renders; configurable limits cap document size, patch size, line count, and asset size.
- **File watching**: the app watches the bundle directory for `review.next.json` publish events and `changes.diff`/`review.json` changes, re-validating and re-rendering on change rather than requiring a manual reload.
- **Distribution boundary**: engine, schemas, `/review-workspace` skill, docs, and synthetic fixtures live in the public MIT repo; real Review Bundles are excluded by repository defaults (gitignore-level) and never required by any test (per ADR 0004).
- **Modules** (naming indicative, not final): `bundle-schema` (JSON Schema + types for the Review Document), `bundle-validator` (the `validateBundle()` seam — schema, Comparison identity, patch parsing, Target resolution, Diagnostics), `patch-parser` (Unified Patch → structured hunks/lines), `publish-cli` (the `open`/`publish` CLI/server seam — atomic write, file watch, write-token enforcement), and `renderer` (deterministic view-model construction from a validated bundle; UI framework consumes this, not raw JSON).

## Testing Decisions

- Tests target external behavior (validity/Diagnostics/exit codes/file state) and never assert on internal function call sequences or private data structures.
- **Primary seam — `validateBundle(bundlePath) → { document, diagnostics[] }`**: a pure function with no server or browser involved. This is where nearly every rule from `framework.md` is decidable: blocking-error vs. Diagnostic classification, schema version support, Comparison identity presence, patch-order fallback when interpretation is missing, and stale/invalid Target detection (e.g. a Line Target whose expected text no longer matches `changes.diff`). Exercised with synthetic fixture bundles only (per ADR 0004) covering: a minimally valid bundle, a bundle with every optional field populated, a bundle with each class of blocking error, and a bundle with each class of recoverable Diagnostic.
- **Secondary seam — CLI/file-state (`open`/`publish`)**: asserts on process exit codes and on-disk state of `review.json`/`review.next.json` before and after a `publish` call — not on server internals or a real browser. Covers: successful atomic publish, publish rejected by validation (original `review.json` untouched), write-token enforcement on mutating requests, and loopback-only binding.
- **Rendering** is tested later, thinly, once a `renderer` module exists: assert that a validated document + patch produce a stable, serializable view model (file ordering, layout-identical content between inline/side-by-side, virtualization not dropping content) rather than snapshotting actual UI pixels.
- Security-relevant behavior (HTML stripping in Markdown, asset path containment, size limits) is tested at the `validateBundle`/`bundle-schema` seam with adversarial fixtures (path traversal attempts, oversized patches, disallowed media types) — this is a security-relevant path per repo-wide conventions and gets explicit negative-case coverage, not just happy-path tests.
- No prior art exists in this repo yet (pre-implementation); the seams above are chosen so that future tests don't depend on a UI framework decision.

## Out of Scope

- Bundle generation itself (any AI/Generator logic) — out of the product boundary per ADR 0001/framework.md.
- Git, GitHub, or GitLab access of any kind.
- Live application orchestration or preview environments.
- Review submission/approval workflows and multi-reviewer collaboration (v1 is single-Reviewer).
- Choice of UI framework/renderer implementation details — this spec fixes the `renderer` seam's contract, not its stack.
- Report/concern-comment export *format* details beyond "supported" (user story 28) — left to implementation/tickets.
- Any tracker or CI integration for the Review Workspace project itself.

## Further Notes

- This repo is pre-implementation: only `CONTEXT.md` (glossary), `docs/framework.md`, and four ADRs exist. No `package.json`, no source, no tests yet — tickets should include initial project scaffolding as prefactoring work.
- Terminology throughout this spec follows `CONTEXT.md` exactly (Review Bundle, Comparison, Review Document, Unified Patch, Generator, Reviewer, Behavioral Group, Annotation, Target, Evidence, Question, Answer, Review State, Diagnostic) — avoid the discouraged synonyms listed there (e.g. "AI", "agent", "report viewer", "chat message").
- No issue tracker is configured for this repo; this spec and its downstream tickets are local files only.

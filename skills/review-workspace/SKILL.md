---
name: review-workspace
description: Acts as the Generator for a Review Workspace bundle — analyzes a Comparison's Unified Patch and writes/updates the bundle's Review Document (review.next.json), then publishes it. Use when the user asks to generate, update, or improve a Review Bundle, points at a bundle path, pastes a GitLab/GitHub MR or PR URL and asks to review/analyze it, or pastes the workspace's "Invoke the /review-workspace skill on this bundle <path>" prompt. See the "Reviewing an MR/PR end-to-end" section below for the full flow when starting from just a URL.
---

# Review workspace (Generator)

You are the **Generator** for the [Review Workspace](https://github.com/sabasayer/review-workspace) engine (a separate project — the schema, validator, server, and UI already exist and are out of scope here; see that repo's ADR 0001/0002). Your only job is to produce a valid Review Document. You never render, serve, or decide anything.

The engine ships as the `review-workspace` npm package — run it with `npx review-workspace <command>`, no local clone needed. `npx` fetches and caches it on first use.

## Start

Read [FRAMEWORK.md](FRAMEWORK.md) in full — it defines the exact Review Document schema and the generation/validation workflow.

Determine the branch:

- **New bundle** — no `review.json`/`changes.diff` exist yet at the given path; you must acquire the Comparison and materialize the bundle directory first.
- **Existing bundle** — `changes.diff` already exists; analyze it and write/update `review.next.json`.
- **Improve** — feedback on an already-published bundle; decide whether it's artifact-specific or a durable framework change.

Ask only for inputs that cannot be inferred: which Comparison (MR/PR/branch/commit range) and where the bundle should live.

## Reviewing an MR/PR end-to-end

The Generator role above only covers producing `review.next.json`. Starting from just a pasted MR/PR URL, the actual end-to-end flow is:

1. **Pick a bundle directory.** Anywhere local works — e.g. `.bundles/<repo-name>-<mr-number>/` in your current project (e.g. `.bundles/xds-widgets-32/`). Nothing needs to already exist there.
2. **Scaffold the bundle:**
   - Fetch the diff: `glab mr diff <N> -R <group>/<project> > .bundles/<name>/changes.diff` (GitHub: `gh pr diff <N> -R <owner>/<repo>` instead). Handles both git `diff --git` and bare `---`/`+++` formats — the engine's parser accepts either.
   - Fetch the MR's metadata: `glab api projects/<url-encoded-group%2Fproject>/merge_requests/<N>` (GitHub: `gh api repos/<owner>/<repo>/pulls/<N>`) — pull `diff_refs.base_sha`/`head_sha`, `title`, `iid`, `web_url`, `author.name`/`username`, `source_branch`, `target_branch`, `description`.
   - Write `.bundles/<name>/review.json` with just `{ schemaVersion: 1, comparison: { repository, base, head, title, number, url, author, sourceBranch, targetBranch, description } }` — this is the *only* file you hand-write; everything else is the Generator's job below.
   - If the description references uploaded images (`/uploads/<hash>/<file>`), fetch them via `glab api projects/<...>/uploads/<hash>/<file>` into `.bundles/<name>/assets/uploads/<hash>/<file>` — a browser `<img>` pointed straight at gitlab.com gets blocked by ORB for private repos (no session cookie flows to a subresource request); routing through the bundle's own `assets/` and the engine's same-origin `/assets/*` route avoids that entirely.
   - Validate it opens: `npx review-workspace open .bundles/<name>` should print "Bundle is valid."
3. **Invoke the Generator** (the rest of this document) against that bundle path — it reads `changes.diff`, writes `review.next.json`, and runs `npx review-workspace publish <bundle>`.
4. **Serve it**: `npx review-workspace serve .bundles/<name> --port 4317` — one process, hosts both the API and the UI (prints a write token too, needed only to raise/answer Questions, not to view). Check `lsof -nP -iTCP:4317 -sTCP:LISTEN` first; if something's already listening (e.g. a previous bundle), ask the user whether to switch it over or run a second instance on another port. Open the printed `http://127.0.0.1:<port>` URL.

For an **existing** bundle someone's already reviewing (Questions raised, feedback on the UI itself), skip straight to invoking the Generator's **Improve** branch — no need to re-scaffold.

## Generate

1. Acquire or read the Comparison's complete Unified Patch and any available evidence (issue/MR description, discussions, pipeline results, base/head image blobs, open Questions in `questions.jsonl`).
2. Build Behavioral Groups: cluster changed files by behavior, assign `risk`, and order them for review (foundational/highest-risk first).
3. Write Annotations at decision-relevant Targets (File/Hunk/Line/Binary) — Line Targets must carry `expectedText` copied exactly from the patch, or the validator will flag them stale.
4. Write Evidence, classified `observed` / `author-claim` / `inference`.
5. Write Verification items, honestly `unverified` unless real proof already exists.
6. Answer any `open` Questions from `questions.jsonl` (one Answer per Question, citing Evidence where applicable).
7. Write a brief `summary` (a sentence or two, plus the most important Annotation/file pointers) so a reviewer can scan intent before the full diff — skip it for a trivial change.
8. Save the result as `review.next.json` in the bundle directory.
9. Run `npx review-workspace publish <bundle>` and report the outcome, including any Diagnostics.

Generation is complete when `publish` succeeds and every source file/hunk in the patch is covered by at least a File-level Target (a Behavioral Group or Annotation), per the framework's validation contract.

## Improve

1. Open the bundle (`npx review-workspace open <bundle>`) and reproduce the reviewer's concern using its Diagnostics/current `review.json`.
2. Identify whether the feedback is:
   - **Artifact-specific** — fix `review.next.json` for this bundle only.
   - **Durable product learning** — update `FRAMEWORK.md`, replacing superseded guidance instead of appending contradictory rules.
3. Write the smallest coherent `review.next.json` update and `publish` again.
4. Re-run the validation contract from `FRAMEWORK.md`.

Improvement is complete when the concern is resolved without weakening any non-negotiable decision, or the framework explicitly records the newly agreed replacement.

## Evidence discipline

- Keep observed evidence, author claims, and your own inference distinguishable (`kind` on each Evidence item) — never present inference as fact.
- Attach explanation to exact evidence; prune commentary that only restates syntax.
- Mark unavailable pipeline, issue, discussion, test, media, or runtime evidence as a gap rather than omitting it silently.
- Never decide approve/request-changes — that's the Reviewer's call, recorded in the app-owned Review State, not something you write.

## Handoff

Report:

- Bundle path and `publish` result (success, or blocking reason/Diagnostics)
- Comparison identity reviewed (base/head)
- File, hunk, addition, and deletion reconciliation against the patch
- Evidence or media gaps
- Any Questions answered
- Any framework decision added or changed

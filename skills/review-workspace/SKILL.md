---
name: review-workspace
description: Reviews a GitLab/GitHub MR or PR and, only when it helps, opens it in the Review Workspace UI. Use when the user asks to review/analyze an MR or PR (pasted URL), or to generate, update, or improve a Review Bundle, points at a bundle path, or pastes the workspace's "Invoke the /review-workspace skill on this bundle <path>" prompt. Review always produces text findings first; the bundle and UI are optional. Pass --no-ui to get the text findings only.
---

# Review workspace (Generator)

You are the **Generator** for the [Review Workspace](https://github.com/sabasayer/review-workspace) engine (a separate project — the schema, validator, server, and UI already exist and are out of scope here; see that repo's ADR 0001/0002). Your only job is to produce a valid Review Document. You never render, serve, or decide anything.

The engine ships as the `review-workspace` npm package — run it with `npx review-workspace <command>`, no local clone needed. `npx` fetches and caches it on first use.

## Start

Read [FRAMEWORK.md](FRAMEWORK.md) in full — it defines the exact Review Document schema and the generation/validation workflow.

Determine the branch:

- **New bundle** — no `review.json`/`changes.diff` exist yet at the given path; you must acquire the Comparison and materialize the bundle directory first.
- **Existing bundle** — `changes.diff` already exists; analyze it and write/update `review.next.json`.
- **New round** — a bundle for this MR already exists somewhere, but its recorded `comparison.head` no longer matches the MR's live head (you fetched the head yourself — the engine never does this over the network). Fetch the new full diff, then run `npx review-workspace round <existingBundle> --live-head <sha> --patch <newDiffFile>` to scaffold the sibling `<name>-r{N}` bundle (with its own Comparison and a `chain.json` linking back). Never edit the existing bundle in place. Treat the freshly scaffolded round as an **Existing bundle** for generation from here on.
- **Improve** — feedback on an already-published bundle; decide whether it's artifact-specific or a durable framework change.

Ask only for inputs that cannot be inferred: which Comparison (MR/PR/branch/commit range) and where the bundle should live.

## Reviewing an MR/PR end-to-end

The flow has two parts. Part 1 (review) always runs. Part 2 (UI) runs only when there are findings and the user says yes.

### Part 1: Review (always, text only)

1. Fetch the diff into a temp file, for example `/tmp/<repo-name>-<mr-number>.diff`. GitLab: `glab mr diff <N> -R <group>/<project>`. GitHub: `gh pr diff <N> -R <owner>/<repo>`. Do not create a bundle yet.
2. Fetch the MR or PR description and discussion. Read them before you judge the change.
3. Analyse the diff. Write each finding as: file, line, problem, suggested fix. Report only real problems. Do not list praise or restatements of the diff.
4. Report in chat:
   - **No findings**: say "No findings", add one line on what you checked, and **stop**. Do not scaffold a bundle. Do not start a server.
   - **Findings**: show the list in chat.

### The `--no-ui` flag

If the caller passes `--no-ui` (or says "no UI", "text only"), stop after step 4. Print the findings, and never ask about the UI. Never scaffold a bundle. Never start a server. Other skills, such as the review step in ship-work, use this to read the text output directly.

### Part 2: UI (optional)

Run this part only if there are findings and `--no-ui` is not set.

1. Ask the user once: "Open these in the review UI?" Do nothing more unless the answer is yes.
2. **Pick a bundle directory.** Anywhere local works, for example `.bundles/<repo-name>-<mr-number>/` in your current project. Nothing needs to exist there.
3. **Scaffold the bundle:**
   - Move the diff from Part 1 to `.bundles/<name>/changes.diff`. The engine accepts both git `diff --git` and bare `---`/`+++` formats.
   - Fetch the metadata: `glab api projects/<url-encoded-group%2Fproject>/merge_requests/<N>` (GitHub: `gh api repos/<owner>/<repo>/pulls/<N>`). Take `diff_refs.base_sha`/`head_sha`, `title`, `iid`, `web_url`, `author.name`/`username`, `source_branch`, `target_branch`, `description`.
   - Write `.bundles/<name>/review.json` with just `{ schemaVersion: 1, comparison: { repository, base, head, title, number, url, author, sourceBranch, targetBranch, description } }`. This is the only file you write by hand.
   - If the description references uploaded images (`/uploads/<hash>/<file>`), fetch them via `glab api projects/<...>/uploads/<hash>/<file>` into `.bundles/<name>/assets/uploads/<hash>/<file>`. A browser `<img>` that points straight at gitlab.com gets blocked by ORB for private repos. The bundle's own `assets/` and the engine's same-origin `/assets/*` route avoid this.
   - Check it opens: `npx review-workspace open .bundles/<name>` must print "Bundle is valid."
4. **Invoke the Generator** (the rest of this document) against that bundle path. Carry the Part 1 findings into Annotations. The Generator reads `changes.diff`, writes `review.next.json`, and runs `npx review-workspace publish <bundle>`.
5. **Serve it**: `npx review-workspace serve .bundles/<name> --port 4317`. Check `lsof -nP -iTCP:4317 -sTCP:LISTEN` first. If something already listens, ask the user: switch it over, or use a second port. Open the printed `http://127.0.0.1:<port>` URL. **Always give the user the printed write token and say what it is for.** Viewing needs no token. Raising or answering a Question needs one.

The `.review-feedback/` hand-off file for `address-review-feedback` is still written by `publish`, as described in "Hand-off export". It exists only after Part 2, because it comes from change-request Comments raised in the UI.

For an **existing** bundle someone's already reviewing (Questions raised, feedback on the UI itself), skip straight to invoking the Generator's **Improve** branch — no need to re-scaffold.

## Generate

This section is Part 2 only. Never start it before the user said yes to the UI, unless they pointed you at an existing bundle or pasted the workspace prompt.

1. Acquire or read the Comparison's complete Unified Patch and any available evidence (issue/MR description, discussion threads — fetch and read these before writing Evidence/Verification, see [FRAMEWORK.md](FRAMEWORK.md)'s non-negotiable #7 and "Discussion Evidence" — pipeline results, base/head image blobs, open Comments — questions and change-requests alike — in `questions.jsonl`).
2. Build Behavioral Groups: cluster changed files by behavior, assign `risk`, and order them for review (foundational/highest-risk first).
3. Write Annotations at decision-relevant Targets (File/Hunk/Line/Binary) — Line Targets must carry `expectedText` copied exactly from the patch, or the validator will flag them stale.
4. Write Evidence, classified `observed` / `author-claim` / `inference`.
5. Write Verification items, honestly `unverified` unless real proof already exists.
6. Answer any `open` Comments of `kind: 'question'` from `questions.jsonl` (one Answer per Question, citing Evidence where applicable). Leave `kind: 'change-request'` entries alone — see [FRAMEWORK.md](FRAMEWORK.md)'s non-negotiable #5.
7. Write a brief `summary` (a sentence or two, plus the most important Annotation/file pointers) so a reviewer can scan intent before the full diff — skip it for a trivial change.
8. Save the result as `review.next.json` in the bundle directory.
9. Run `npx review-workspace publish <bundle>` and report the outcome, including any Diagnostics. If the bundle has open change-request Comments, this also exports them as a hand-off file into the *target repo's* own working tree (not the bundle directory) — see "Hand-off export" below. The first time this happens for a repo it doesn't already have a cached local path for, it prompts on stdin for that path; answer it if you're the one driving the CLI, or pass it on to the user immediately if you're not.

Generation is complete when `publish` succeeds and every source file/hunk in the patch is covered by at least a File-level Target (a Behavioral Group or Annotation), per the framework's validation contract.

## Improve

1. Open the bundle (`npx review-workspace open <bundle>`) and reproduce the reviewer's concern using its Diagnostics/current `review.json`.
2. Identify whether the feedback is:
   - **Artifact-specific** — fix `review.next.json` for this bundle only.
   - **Durable product learning** — update `FRAMEWORK.md`, replacing superseded guidance instead of appending contradictory rules.
3. Write the smallest coherent `review.next.json` update and `publish` again — this re-triggers the hand-off export in "Hand-off export" below exactly as a first-time publish would, if open change-request Comments exist.
4. Re-run the validation contract from `FRAMEWORK.md`.

Improvement is complete when the concern is resolved without weakening any non-negotiable decision, or the framework explicitly records the newly agreed replacement.

## Hand-off export

A `publish` (Generate step 9 or Improve step 3) that succeeds on a bundle with at least one open `kind: 'change-request'` Comment writes `.review-feedback/<mr-number>-round<N>.md` into the *target repo's* own local working tree — a different filesystem location than the bundle you've been working in, containing those comments raw (grouped by file, with their Targets) for a separate implementer-side skill to act on later. This is a no-op when there are no open change-requests.

The first time this happens for a given repo, it needs that repo's local checkout path and asks for it on stdin (`Local checkout path for <repo-slug>: `); the answer is cached in `~/.claude/review-workspace-repo-paths.json` and reused silently for that repo afterward (re-asked only if the cached path no longer exists on disk). It also ensures `.review-feedback/` is listed in that repo's `.gitignore`.

Always report back where this landed — see "Report back" below.

## Report back

(Not to be confused with the "hand-off export" above — this is what you tell the *user*, not the file exported to another repo.)

Report:

- Always: the Part 1 findings (or "No findings"), and whether the UI was offered, accepted, or skipped by `--no-ui`. Skip the rest of this list if no bundle was made.
- Bundle path and `publish` result (success, or blocking reason/Diagnostics)
- Comparison identity reviewed (base/head)
- File, hunk, addition, and deletion reconciliation against the patch
- Evidence or media gaps
- Any Questions answered — and, separately, how many open change-requests exist (never claim one was addressed; that's not yours to say)
- If a hand-off file was exported: its path in the target repo, which repo local-path was used (freshly asked or from cache), and the round number
- Any framework decision added or changed
- If served: the URL, the write token, and what the token is for (raising/answering Questions, or raising a change-request) — always share it, never withhold it as an implementation detail

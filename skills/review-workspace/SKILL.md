---
name: review-workspace
description: Reviews a GitLab/GitHub MR or PR and, only when it helps, opens it in the Review Workspace UI. Use when the user asks to review/analyze an MR or PR (pasted URL), or to generate, update, or improve a Review Bundle, points at a bundle path, or pastes the workspace's "Invoke the /review-workspace skill on this bundle <path>" prompt. Review always produces text findings first; the bundle and UI are optional. Pass --no-ui to get the text findings only.
---

# Review workspace (Generator)

You are the **Generator** for the [Review Workspace](https://github.com/sabasayer/review-workspace) engine (a separate project — the schema, validator, server, and UI already exist and are out of scope here; see that repo's ADR 0001/0002). Your only job is to produce a valid Review Document. You never render, serve, or decide anything.

The engine ships as the `review-workspace` npm package — run it with `npx review-workspace <command>`, no local clone needed. `npx` fetches and caches it on first use.

## Start

Read [FRAMEWORK.md](FRAMEWORK.md) in full. It defines the exact Review Document schema and the generation/validation workflow.

Determine the branch:

- **New bundle** — no `review.json`/`changes.diff` exist yet at the given path. Run the Review Brief, Setup and "Reviewing an MR/PR end-to-end" below.
- **Existing bundle** — `changes.diff` already exists. Analyze it and write/update `review.next.json`.
- **New round** — a bundle for this MR exists, and `live-head.json` shows a `head` that differs from `comparison.head`. The Reviewer starts a new round by hand, after the UI banner "The MR has new commits since round N". Fetch the new full diff. Then run `npx review-workspace round <existingBundle> --live-head <sha> --patch <newDiffFile>` to scaffold the sibling `<name>-r{N}` bundle (own Comparison, and a `chain.json` that links back). Never edit the existing bundle in place. Treat the new round as an **Existing bundle** from here on.
- **Local branch** — no MR or PR exists yet, for example a crew run at its captain test. Follow "Local branch mode" below in place of the forge steps.
- **Improve** — feedback on an already-published bundle. Decide if it is artifact-specific or a durable framework change.

## Review Brief

Ask once, at the start of a review. Suggest an answer for each item, so the Reviewer only corrects.

- **Stack** — the sibling MRs this MR depends on or feeds. Find them with `glab mr list -R <group>/<project>` and the MR text. Show the list for correction.
- **Author** — who wrote the code: a person or an agent.
- **Answer Questions live? Cap: 20.** The default cap is 20. The Reviewer can change it. A "yes" turns on the Watcher below.
- **Start the app?** Default yes when the repo's `package.json` has a `dev:offline` or `dev` script. Default no otherwise.
- **Should the agent check the feature in the browser?** Default no.
- **Where the repo is** — ask only if the path is not clear from the current directory.

Keep the answers. Stale parent commits go into the Brief as a warning.

## Setup

Run this before the Generator. Never install in the Reviewer's own checkout.

1. Find the local repo from the current directory or the Brief. If it is not there, clone it.
2. Make a git worktree for the MR's `sourceBranch`. Put it beside the bundles, for example `~/Work/review-bundles/<repo>-<N>-src`. Check out the MR head.
3. Install with the repo's lockfile command (for example `pnpm install --frozen-lockfile`) inside the worktree.
4. Read the run recipe from `package.json` scripts and from `docs/usage.md` (or similar docs), as well as the README, `AGENTS.md` and e2e helpers. `AGENTS.md` and `CLAUDE.md` can be out of date, so trust the scripts and usage docs first. Note the env flags, the certs to copy from the main checkout and any session keys.
5. When the Reviewer said yes to "Start the app?", start it as a background task in the review worktree. Then give the Reviewer the URL. Report what you ran.
6. Sometimes the app cannot show the feature. For example, the offline data may lack the needed user or organization. Then say so in the report. Write a Verification `gap` with `targetIds` at the Annotation it concerns. Never edit the repo under review to make the app work.

Setup is complete when the worktree is on the MR head, the recipe is known and the app runs (or the gap is written).

### Browser check

Do this only when the Reviewer said yes to "Should the agent check the feature in the browser?".

1. Open the running app with a browser tool, if one exists (the chrome-devtools MCP). Use the feature as a user would.
2. Save screenshots under the bundle's `assets/`. Write each one as `observed` Evidence. The description says what the screenshot shows.
3. If no browser tool exists, say so in the report. Write a Verification `gap` anchored at the Annotation it concerns.
4. These screenshots are Evidence. They are never Intent Visuals. Visuals take only MR-text images and diff snapshot images.

## Reviewing an MR/PR end-to-end

The flow has two parts. Part 1 (review) always runs. Part 2 (UI) runs only when there are findings and the user says yes.

### Part 1: Review (always, text only)

1. Fetch the diff into a temp file, for example `/tmp/<repo-name>-<mr-number>.diff`. GitLab: `glab mr diff <N> -R <group>/<project>`. GitHub: `gh pr diff <N> -R <owner>/<repo>`. Always use the forge's diff. Never build it from the MR's own commits with `git diff`. Inline comments need lines that are in the forge's diff. Do not create a bundle yet.
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
2. **Pick a bundle directory.** Anywhere local works, for example `.bundles/<repo-name>-<mr-number>/`. Nothing needs to exist there.
3. **Scaffold the bundle:**
   - Move the diff from Part 1 to `.bundles/<name>/changes.diff`. The engine accepts both git `diff --git` and bare `---`/`+++` formats.
   - Fetch the MR's metadata: `glab api projects/<url-encoded-group%2Fproject>/merge_requests/<N>` (GitHub: `gh api repos/<owner>/<repo>/pulls/<N>`). Take `diff_refs.base_sha`/`head_sha`, `title`, `iid`, `web_url`, `author.name`/`username`, `source_branch`, `target_branch`, `description`.
   - Write `.bundles/<name>/review.json` with just `{ schemaVersion: 2, comparison: { repository, base, head, title, number, url, author, sourceBranch, targetBranch, description } }`. This is the only file you hand-write. The Generator writes the rest.
   - Write `live-head.json` (see "Live head" below).
   - If the description references uploaded images (`/uploads/<hash>/<file>`), fetch them via `glab api projects/<...>/uploads/<hash>/<file>` into `.bundles/<name>/assets/uploads/<hash>/<file>`. A browser `<img>` that points at gitlab.com is blocked for private repos. The bundle's own `assets/` and the engine's same-origin `/assets/*` route avoid that.
   - **Changed images are a hard step.** List every `png`/`jpg`/`gif`/`webp` and `Binary files ... differ` line in `changes.diff`. For each one, fetch the base and the head blob now (`git show <sha>:<path>` in the Setup worktree, or `glab api` as in [FRAMEWORK.md](FRAMEWORK.md) "Binary/image Targets") into `.bundles/<name>/assets/`. The UI shows nothing for an image without them, and does not say why. Do not start the Generator before every changed image has both files, or a recorded `gap`.
   - Validate it opens: `npx review-workspace open .bundles/<name>` should print "Bundle is valid."
4. **Invoke the Generator** (the next section) against that bundle path. Carry the Part 1 findings into Annotations.
5. **Serve it**: `npx review-workspace serve .bundles/<name> --port 4317`. One process hosts the API and the UI. Check `lsof -nP -iTCP:4317 -sTCP:LISTEN` first. If something is already listening, ask the user whether to switch it or use another port. Give the user the printed `http://127.0.0.1:<port>` URL. **Always give the printed write token too, and say what it is for.** Viewing needs no token. Raising or answering a Question in the UI does.
6. **Check the UI.** After publish, open the served URL. Look at a sample of notes and Answers: markdown and code blocks render, Target code shows, each image shows. Fix the bundle and publish again when something is off.

The `.review-feedback/` hand-off file for `address-review-feedback` is still written by `publish`, as described in "Hand-off export". It exists only after Part 2, because it comes from change-request Comments raised in the UI.

For an **existing** bundle someone already reviews (Questions raised, feedback on the UI itself), go straight to the Generator's **Improve** branch. Do not scaffold again.

### Live head

Whenever you open or update a bundle, fetch the MR's live head (`head_sha` from the metadata call, or `glab api .../merge_requests/<N>`). Write `live-head.json` into the bundle: `{ "head": "<sha>", "checkedAt": "<ISO date and time>" }`. If the fetch fails, do not write the file. The engine only reads this file.

## Local branch mode

Use this when the caller gives a repo path and a branch, and says there is no MR yet. Nothing is posted anywhere, so the local diff is enough.

1. In the repo, run `git fetch origin`. The base is `git merge-base origin/<default branch> <branch>`. The head is `git rev-parse <branch>`.
2. Write the diff: `git diff <base> <head> > /tmp/<repo-name>-<branch-slug>.diff`. This replaces the forge diff in Part 1 step 1.
3. Skip every forge step: MR text, discussions, pipeline jobs, uploads, Stack, and posting comments.
4. `review.json` gets `{ schemaVersion: 2, comparison: { repository, base, head, title, sourceBranch, targetBranch } }`. Leave out `number` and `url`. `repository` is the remote path, like `group/project`. `title` is the last commit subject, or the caller's title.
5. Live head: run `git rev-parse <branch>` in place of the forge call.
6. The bundle name is `<repo-name>-<branch-slug>`. The hand-off file is `.review-feedback/<branch-slug>-round<N>.md`. The engine names it from `sourceBranch` when there is no `number`.
7. Changed images: take both blobs with `git show <sha>:<path>`.

Everything else (Generator, Publish, rounds, hand-off) works as for an MR.

## Generate

This section is Part 2 only. Never start it before the user said yes to the UI, unless they pointed you at an existing bundle or pasted the workspace prompt.

1. Acquire or read the Comparison's complete Unified Patch and any available evidence (issue/MR description, discussion threads — fetch and read these before writing Evidence/Verification, see [FRAMEWORK.md](FRAMEWORK.md)'s non-negotiable #7 and "Discussion Evidence" — pipeline results, base/head image blobs, open Comments, questions and change-requests alike, in `questions.jsonl`).
2. Write the `intent` first: what the change does, why, what it does not do, and the `sources` of those claims. Read the MR text and follow its linked issue before you write it. If the MR text is too weak to state the intent, set `weakDescription` and say what is missing. If a parent commit of the MR is stale, say so in the Intent. Write `intent.visuals` from images in the MR text and from changed snapshot images (base and head). Never use your own app screenshot. See [FRAMEWORK.md](FRAMEWORK.md) "Visuals".
3. **Stack search.** Do this before any note that says "missing", "unused" or "no caller". List the sibling MRs of the stack (from the Brief). Grep each one's diff for the symbol or behaviour. When a sibling MR has it, say which MR in the note. Name what you searched in the note. A stale parent gets a warning in the Intent and the Review Brief only. It gets no group.
4. Build Behavioral Groups: cluster changed files by behavior, assign `risk`, and order them for review (foundational/highest-risk first).
5. Write Annotations at decision-relevant Targets (File/Hunk/Line/Binary). Line Targets must carry `expectedText` copied exactly from the patch, or the validator flags them stale. Set `schemaVersion: 2`. Give every note `verdict`, `severity`, `source` and, for `wrong` or `missing`, a `suggestion`. A finding with no code line uses the general Target `{ type: 'general' }`.
6. Write Evidence, classified `observed` / `author-claim` / `inference`. Write a proof-link Evidence for a clear match only: a changed snapshot whose test file is in the same MR. See [FRAMEWORK.md](FRAMEWORK.md) "Proof links".
7. Write Verification items, honestly `unverified` unless real proof already exists.
8. Answer any `open` Comments of `kind: 'question'` from `questions.jsonl` (one Answer per Question, citing Evidence where applicable). Leave `kind: 'change-request'` entries alone — see [FRAMEWORK.md](FRAMEWORK.md)'s non-negotiable #5.
9. Write a brief `summary` (a sentence or two, plus the most important Annotation/file pointers) so a reviewer can scan intent before the full diff. Skip it for a trivial change.
10. Save the result as `review.next.json` in the bundle directory.
11. Run `npx review-workspace publish <bundle> --repo <target-repo-path>` and report the outcome, including any Diagnostics. Always pass `--repo`. It is the local repo under review (the Setup worktree is fine). See "Hand-off export". Never run publish in a way that prompts.

Generation is complete when `publish` succeeds, every source file/hunk in the patch is covered by at least a File-level Target, and the UI check in "Reviewing an MR/PR end-to-end" Part 2 step 6 is done.

## Watcher

Opt-in per session. Start it only when the Reviewer said yes to "Answer Questions live?" in the Brief.

Run it as a background task:

`node <skill-dir>/watch-questions.mjs <bundle> --repo <repo-path> --cap <cap>`

For each new open Question, the script runs a cheaper model (default `haiku`, change with `--model`). The prompt holds the Question, its Target code and its Thread. The model may also read files under `--repo`, read-only: the script runs `claude` in the repo path with only the `Read`, `Grep` and `Glob` tools. It has no write, shell or network tool. The prompt tells it to read what the Question needs, then answer, and to say what it read. The script writes the Answer into `review.next.json`, publishes, and writes `watcher.json` into the bundle: `{ enabled, cap, used, current, updatedAt }`. While it works on a Question, `current` holds the id of that Question. It is `null` after the Answer, and after an error. The UI uses it to show the state "answering". `updatedAt` is the heartbeat (a time stamp the watcher renews on each tick). The script writes the file on every 3 s tick. The UI marks the watcher as stopped when `updatedAt` is over 30 s old. While `current` holds a Question id, the limit is 5 min, because one answer can take minutes. A file with no `updatedAt` never counts as stopped. A stopped watcher shows "Live answers: watcher stopped". The UI then offers "Send to agent". At the cap it stops and sets `enabled` to false. The UI then falls back to "Send to agent". Check the script with `node <skill-dir>/watch-questions.mjs --self-check`. The check proves that the repo path is passed, that only read-only tools are allowed, that the cap works and that `current` is set while a Question is answered and cleared after the Answer or an error.

## Posting

You own posting a Comment to the MR. The UI only marks a Comment for posting.

1. Draft the MR comment from the Comment's text. A Question to the author is a Comment posted this way. It is not a new kind.
2. Write very simple words. Use short sentences. Give no long explanations.
3. Show the draft to the Reviewer. Wait for the word "send". Never post before it.
4. Post inline with a JSON body: `glab api projects/<id>/merge_requests/<N>/discussions --method POST -H "Content-Type: application/json" --input <file.json>`. The body holds `body` and a `position` with `base_sha`, `start_sha`, `head_sha` of the live head, `position_type: "text"`, the paths and the line. Never use `-f position[...]`: it makes a general thread, not an inline one.
5. If the line is not in GitLab's diff at the live head, tell the Reviewer. Do not turn it into a general comment on your own. Ask first, as in "General Comments" below.

### General Comments

A Comment with the general Target `{ type: 'general' }` has no line. Never post it inline.

1. Draft it as in step 1 and 2 above.
2. Show the draft. Say it would be a general MR comment, not an inline one. Ask if the Reviewer agrees to a general comment.
3. Post it as a general MR comment (`glab api projects/<id>/merge_requests/<N>/notes --method POST`) only after the Reviewer says "send" and agrees to a general comment. Without both, post nothing.
4. The rule "never post anything before send" stays for every Comment.

## Improve

1. Open the bundle (`npx review-workspace open <bundle>`) and reproduce the reviewer's concern using its Diagnostics/current `review.json`.
2. Identify whether the feedback is:
   - **Artifact-specific** — fix `review.next.json` for this bundle only.
   - **Durable product learning** — update `FRAMEWORK.md`, replacing superseded guidance instead of appending contradictory rules.
3. Write the smallest coherent `review.next.json` update and `publish` again — this re-triggers the hand-off export in "Hand-off export" below exactly as a first-time publish would, if open change-request Comments exist.
4. Re-run the validation contract from `FRAMEWORK.md`.

Improvement is complete when the concern is resolved without weakening any non-negotiable decision, or the framework explicitly records the newly agreed replacement.

## Hand-off export

A `publish` (Generate step 11 or Improve step 3) that succeeds on a bundle with at least one open `kind: 'change-request'` Comment writes `.review-feedback/<mr-number>-round<N>.md` into the *target repo's* own local working tree. This is a different place than the bundle. The file holds those comments raw (grouped by file, with their Targets) for a separate implementer-side skill to act on later. It does nothing when there are no open change-requests.

Pass the repo path with `--repo <path>`. The command never asks for it on stdin. If you pass no `--repo`, `publish` prints one line (`Hand-off skipped: pass --repo <path> ...`) and skips the export. Run `publish` again with `--repo` to export. The same happens, with a different line, when the path is not a git repository.

The command lists `.review-feedback/` in the repo's `.git/info/exclude`. It finds that file with `git rev-parse --git-path info/exclude`, so worktrees work. It never edits `.gitignore`.

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
- If a hand-off file was exported: its path in the target repo, which `--repo` path was used (or that the export was skipped for lack of one), and the round number
- Backup: `publish` and `serve` copy the bundle to `~/.claude/review-workspace-backups/`. If the UI says `bundle folder is gone` (a `503`), tell the user to copy the backup folder back.
- If the Watcher ran: the cap and how many Answers it used. If you posted to the MR: how many comments and where
- Any framework decision added or changed
- If served: the URL, the write token, and what the token is for (raising/answering Questions, or raising a change-request) — always share it, never withhold it as an implementation detail

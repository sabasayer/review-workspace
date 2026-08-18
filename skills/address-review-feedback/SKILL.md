---
name: address-review-feedback
description: Acts as the implementer on the receiving end of a Review Workspace hand-off file — reads its open change-request Comments, implements or explicitly skips each one against the target repo's own conventions, runs the target repo's own verification, writes a structured response file, and commits and pushes. Use when the user asks to address review feedback, points at a `.review-feedback/<mr-number>-round<N>.md` file, or asks to act on a hand-off from the `review-workspace` skill.
---

# Address review feedback (implementer)

You are the **implementer** on the receiving end of a [Review Workspace](https://github.com/sabasayer/review-workspace) hand-off file — the file the `review-workspace` skill's Generator exports into this repo's own working tree when a bundle has open `change-request` Comments. Your job is to act on that file in *this* repo, using *this* repo's own conventions — never review-workspace's own `AGENTS.md`/`docs/development.md`, which govern a different codebase entirely.

## 1. Locate the hand-off file

- **Given an explicit path** — use it directly.
- **Given nothing** — look in the current working directory's `.review-feedback/` for files named `<mr-number>-round<N>.md` that don't yet have a matching `<mr-number>-round<N>.response.json` sitting next to them, and pick the highest round number found.
- If more than one distinct MR number has an unaddressed hand-off file, **ask which one** rather than guessing.
- If none is found, say so and stop — there's nothing to act on.

## 2. Parse its metadata

Read the file's `<!-- review-workspace-handoff ... -->` block with `parseHandoffMetadata` (`src/handoff/parse-handoff-metadata.ts` in the review-workspace repo, or `import { parseHandoffMetadata } from 'review-workspace'`-equivalent if consumed as a package) to recover `{ bundlePath, repository, mrNumber, round }`. Everything you need — which bundle produced this, which MR, which round — comes from this file alone; no other lookup or human-supplied context is required.

If the block is missing or malformed, say so and stop rather than guessing at the missing fields.

## 3. Read the target repo's own conventions

This repo (the one you're standing in, with the `.review-feedback/` directory) is the target — read *its own* `AGENTS.md`/`CLAUDE.md`/equivalent, not review-workspace's. Note its test/typecheck/lint commands for step 5, and its commit-message convention for step 6.

## 4. Act on every open change-request

Read every change-request Comment in the file exactly as written — no summary, no reinterpretation — grouped by file, each with its exact Target (file/hunk/line/binary) so you know precisely what code it refers to.

For each one:

- **Implement a fix**, following the target repo's own conventions from step 3.
- **Or explicitly skip it** with a stated reason ("needs a design-spec answer first," "can't reproduce," "out of scope for this ticket," etc.).

Never silently drop a comment — every one gets either a fix or a stated reason, tracked as a `{ commentId, status: 'addressed' | 'skipped', reason?, whatIChanged? }` entry for step 5.

You never mark a change-request `resolved` yourself — that stays the human Reviewer's call in review-workspace's own Review State. You also never claim a fix is "verified" beyond what step 5's real test run actually showed.

## 5. Run the target repo's own verification

Run this repo's own test/typecheck/lint commands (from step 3) — not review-workspace's. Report the real output; don't claim success without having run anything.

## 6. Write the response file

Call `writeHandoffResponse` (`src/handoff/write-handoff-response.ts`) with the hand-off file's path, the `mrNumber`/`round` from step 2, and the array of per-comment entries from step 4. It writes `<mr-number>-round<N>.response.json` next to the hand-off file, in the same `.review-feedback/` directory — a structured, machine-readable account of what you did, for the next round's Generator to read as a starting point. Label it clearly as an author's claim, not fact, when you report it.

## 7. Commit and push

Commit (conventional-commit style matching the target repo's own convention where discoverable) and push. **This step completes independent of step 8** — it must be done and reported regardless of what happens next.

## 8. Ask about the next round

Ask the user directly: *spawn a separate background agent, pointed at the bundle path from the hand-off metadata, to run the `review-workspace` skill for the next round?*

- **Only proceed on an explicit yes.** Spawn a genuinely separate agent — not a continuation of this session/context, so the fix isn't graded by the same context that wrote it — pointed at `bundlePath` from step 2, running the `review-workspace` skill.
- **A no, or no answer, changes nothing already done.** Steps 3–7 are already complete and already reported; don't wait on this answer to consider your own work finished, and don't let a "no" undo or qualify anything.
- Never spawn one automatically, and never skip asking.

## Out of the skill's control

- Never mark a change-request `resolved` — human-only, per step 4.
- Never claim a fix is "verified" beyond the target repo's own real test output from step 5.
- Never retry or repair a previous round's incomplete response file — if an earlier invocation was interrupted, just proceed normally against whatever hand-off file you find now.
- Never auto-trigger anything — no watcher, no auto-spawn without step 8's question being asked and answered yes.

## Report back

Mirror the Generator skill's own reporting discipline. Report:

- Which hand-off file was located (path, MR number, round) and how (explicit path, or auto-discovered)
- Every change-request Comment: addressed or skipped, and why
- The target repo's own verification output — real, not assumed
- The response file's path
- Whether the commit/push completed (this is unconditional — report it even if the next-round question below gets a "no" or no answer)
- Whether a background review agent was spawned for the next round, and if so, how to find it — or that none was, because the answer was no/none given

# Review Workspace Generator Framework

Generation and validation decisions for producing a Review Bundle's Review Document. Updated 2026-07-28.

This framework covers the **Generator's** job only. The bundle contract, schema, validator, CLI, server, and UI are owned by the [review-workspace engine repo](https://github.com/sabasayer/review-workspace) (see its `docs/framework.md` and ADRs) — this document does not restate or override those; it tells the Generator how to produce content that fits them.

## Product thesis

A review workspace turns a flat file diff into an evidence-linked map of intent, behavior, risk, and observable effects. Its job is to help an experienced maintainer reach a defensible decision faster without moving among the forge, issue tracker, IDE, pipeline UI, and preview.

The workspace is a decision surface, not an AI report. Code remains primary; generated explanation stays attached to the evidence it interprets. The Generator never renders anything and never decides approve/request-changes — it only writes a `review.next.json` for the engine to validate and publish.

## Non-negotiable decisions

1. **Cover the complete diff.** Every changed file must be reachable through at least a File-level Target (directly, or via a Behavioral Group). Summaries and excerpts orient the reviewer but never replace the diff — the engine renders the full patch regardless of what you annotate.
2. **Order by review logic.** Group files into Behavioral Groups and order them (`order`) by dependency, risk, and reviewer comprehension rather than alphabetically. Assign `risk` (`low`/`medium`/`high`) to every group.
3. **Keep evidence local.** Attach Annotations and Evidence to the exact Target they concern, not a disconnected summary block.
4. **Preserve reviewer judgment.** Classify every Evidence item's `kind` (`observed`, `author-claim`, `inference`) so the UI can distinguish observed fact from your inference. Never present inference as fact or make the approval decision.
5. **Answer, don't chat.** Respond to open Questions (`questions.jsonl`) with exactly one Answer per Question, citing Evidence where applicable — never as free-form commentary elsewhere in the document.
6. **Be honest about verification.** Mark a Verification item `unverified` unless real proof (a passing test, an observed run, a matching snapshot) already exists. A screenshot or a green mocked test is not proof of real backend behavior.

## The Review Document you produce

Written to `review.next.json` in the bundle directory, validated against [`schemas/review-document.schema.json`](https://github.com/sabasayer/review-workspace/blob/main/schemas/review-document.schema.json) in the engine repo (also what `npx review-workspace open`/`publish` validate against under the hood — no need to fetch it yourself). Shape (fields you actually set — see that schema file for the authoritative, exact definition):

```
{
  schemaVersion: 1,
  comparison: { base, head, repository?, title?, number?, url?, author?, sourceBranch?, targetBranch?, description? },
                                                   // must exactly match the existing review.json's comparison
  behavioralGroups: [
    { id, title, description?, order, risk?: 'low'|'medium'|'high', targets: [Target, ...] }
  ],
  annotations: [
    { id, target: Target, summary, kind?: 'intent'|'behavior'|'risk', evidenceIds?: [string],
      relatedTargets?: [{ target: Target, reason }, ...] }
  ],
  evidence: [
    { id, kind: 'observed'|'author-claim'|'inference', description, targetIds?: [string], assetPath?, baseAssetPath?,
      pipeline?: { jobName, status: 'success'|'failed'|'running'|'canceled'|'skipped', url, logExcerpt? } }
  ],
  verification: [
    { id, description, status: 'unverified'|'verified'|'gap', targetIds?: [string] }
  ],
  answers: [
    { id, questionId, body, evidenceIds?: [string] }   // questionId must match an id from questions.jsonl
  ]
}
```

**Target** (used by `behavioralGroups[].targets`, `annotations[].target`) is one of:

- `{ type: 'file', path }`
- `{ type: 'hunk', path, hunkIndex }` — 0-based index into that file's hunks in `changes.diff`
- `{ type: 'line', path, side: 'base'|'head', line, expectedText }` — `expectedText` must be copied **exactly** (including leading whitespace) from the patch line at that position, or the engine will flag it as a stale Diagnostic
- `{ type: 'binary', path }`

`evidence[].targetIds` and `verification[].targetIds` hold ids of other document entries (e.g. an annotation id) they relate to — they are not diff Targets and are not resolved against the patch.

`annotations[].relatedTargets` lets an Annotation point at a Target in a *different* file with a `reason` — for a claim that depends on something elsewhere in the diff (e.g. "this prop removal is safe because its only consumer was updated in the same commit, see f-user-menu.vue"). This is not call-graph inference: only record a relatedTarget for something you already read and can name a Target for, never a guessed dependency. Each relatedTarget's `target` is resolved against the patch exactly like a primary Target (same stale/unresolved Diagnostics apply), so `expectedText` on a `line`-type relatedTarget must still match exactly.

`evidence[].assetPath` and `evidence[].baseAssetPath` are paths relative to the bundle's `assets/` directory. Only place PNG/JPG/JPEG/GIF/WEBP there — anything else, or any path that escapes `assets/`, is rejected by the engine as a Diagnostic, not silently accepted.

### Binary/image Targets

When a `binary` Target has real base and head revisions to compare (a `png`/`jpg`/`gif`/`webp` changed in the patch, e.g. a visual regression snapshot), fetch **both** blobs rather than describing the change from the diff header alone — `Binary files ... differ` tells you nothing about what actually changed:

1. Fetch the base-revision blob and the head-revision blob for that file path (e.g. via `glab api projects/<url-encoded-project>/repository/files/<url-encoded-path>/raw?ref=<sha>` once per revision, using `comparison.base`/`comparison.head`).
2. Save both under the bundle's `assets/` directory with names that make the pairing obvious (e.g. `assets/<slug-of-the-file-path>/base.png` and `.../head.png`).
3. Write one Evidence entry with `assetPath` set to the **head** image and `baseAssetPath` set to the **base** image, `targetIds` referencing the binary Target's file path. The engine only offers the reviewer side-by-side/swipe/onion-skin/changed-pixel comparison modes when both are present — a lone `assetPath` with no `baseAssetPath` renders as a single reference image with no comparison affordance.

If either blob can't be retrieved (deleted file, inaccessible ref, non-image binary), don't fabricate a substitute — record a Verification `gap` instead, same as any other missing evidence.

### Pipeline Evidence

When the Comparison has an associated CI pipeline (e.g. a GitLab MR's `head_pipeline`), fetch the actual job results rather than trusting the MR description's claims about test status — "tests pass" in a description is an author-claim until you've looked at the job yourself:

1. Fetch the pipeline's jobs (e.g. `glab api projects/<url-encoded-project>/pipelines/<pipeline_id>/jobs`).
2. For any job worth surfacing — especially a **failed** job that's plausibly related to files in this diff — fetch its trace (`glab api projects/<url-encoded-project>/jobs/<job_id>/trace`) and pull the relevant excerpt (the failing assertion/stack trace), not the entire log.
3. Write one Evidence entry per job worth surfacing, with `kind: 'observed'` (you looked at the real job) and a `pipeline` object: `{ jobName, status, url, logExcerpt? }`. Set `targetIds` to the file path(s) or annotation id(s) this job's result is evidence for.
4. A **failed** job that's evidence *against* a claim (e.g. "this fix works" but the job that would prove it failed) is exactly as valuable as a passing one — record it as Evidence either way, and let a Verification item or Annotation state what it means for the claim. Never omit a failure because it's inconvenient to the narrative.
5. If no pipeline exists yet, or a specific job's relevance to this diff is unclear, don't fabricate a pipeline Evidence entry — record a Verification `gap` instead, same as any other missing evidence.

## Generation workflow

### 1. Acquire source material

Read from the bundle directory and, if materializing a brand-new bundle, from the source Comparison:

- `changes.diff` — the complete, authoritative Unified Patch (git-style `diff --git` or bare POSIX `---`/`+++` format, both are valid)
- `review.json` — the last published Review Document, if any (its `comparison` identity must match exactly)
- `questions.jsonl` — open Questions needing Answers
- `assets/` — evidence images already present
- Whatever's available externally: issue/MR description, discussions, pipeline jobs and failures, base/head image blobs, runtime previews
- The Comparison's own identity metadata (title, number, url, author, source/target branch, description) — set these on `comparison` whenever the source system exposes them (e.g. a GitLab/GitHub MR); the UI's metadata panel has nothing to show without them

If evidence is unavailable, record it as a Verification `gap`. Do not manufacture a substitute.

**Complete when:** every changed file in `changes.diff` is accounted for and every claim you write has a source Target or is explicitly labeled inference.

### 2. Build the review map

Trace changed symbols and behavior across files. Define Behavioral Groups, assign `risk` and `order`, and write a short `description` stating the reason for that group and its position in the order.

Prefer a small number of meaningful groups. A file may relate to several behaviors — choose one primary group (via a File Target) and use Annotations/Evidence `targetIds` for secondary relationships instead of duplicating the file across groups.

**Complete when:** every changed file has a primary Target and the group order forms a coherent review path.

### 3. Create annotations

Annotate decision-relevant Targets: intent boundaries, behavior changes, risk, removed safeguards, test evidence, pipeline causality, cross-file contracts. Avoid narrating obvious syntax — the diff already shows the code.

**Complete when:** each important claim points to an exact Target and low-value commentary has been pruned.

### 4. Attach evidence and verification

For each Annotation or Behavioral Group that needs support, add Evidence with the correct `kind` and, if applicable, an `assetPath` under `assets/`. Add Verification items for anything the Reviewer should be able to check off, honestly scored.

**Complete when:** every risk-relevant claim has either Evidence or an explicit Verification gap.

### 5. Answer open Questions

For each `open` entry in `questions.jsonl`, write exactly one Answer referencing its `questionId`, citing Evidence where applicable. Never leave an open Question unanswered if you have the information to answer it — leave it open only when you genuinely don't.

### 6. Publish

Write the document to `review.next.json`, then run `review-workspace publish <bundle>` (the engine's CLI). Report the result:

- **Success** — `review.json` now matches what you wrote.
- **Rejected** — the engine's blocking reason/message; fix and republish. Common causes: `comparison` mismatch, a Line Target's `expectedText` not matching the patch exactly, or an unsupported `schemaVersion`.

**Complete when:** `publish` succeeds and running `review-workspace open <bundle>` shows the Diagnostics you expect (ideally none, for anything you were confident about).

## Quality test

Remove any Annotation or Evidence item that competes with the code without increasing decision confidence. Add one only when it answers one of these questions:

- What behavior is intended to change?
- Where is that behavior implemented across files?
- What could break and how large is the blast radius?
- What evidence shows the change works?
- What remains uncertain before approval?

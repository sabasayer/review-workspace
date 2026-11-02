# A Comment may have a general Target

A Comment can now use the general Target, `{ type: 'general' }`. It points at the whole Comparison. [ADR 0005](0005-note-fields-general-target-proof-links-live-head.md) allowed this only for an Annotation.

The reason is the suggestion buttons. A finding about the whole change has no code line. The Reviewer still wants to raise a change-request from its suggestion, or to ask a Question about it. Without a general Target, the Comment would need a fake file or no Target at all.

What changes:

- The engine checks the Target of every new Comment. A bad Target gives a 400 error and writes nothing to `questions.jsonl`.
- A general Comment is never stale. It is never "touched by the diff". It has no Resolution status. Only the Reviewer resolves it.
- An open general change-request carries forward to the next round, like any other open change-request.
- The hand-off export lists general change-requests under a "General" heading, after the files.
- The UI shows a general Comment in the Question panel. It also shows it in "Before you read the code", under the findings.
- The skill never posts a general Comment inline. It drafts it. It posts a general MR comment only after the Reviewer says "send" and agrees to a general comment.

The Review Document schema does not change. Comments live in `questions.jsonl`, not in `review.json`. Documents with `schemaVersion` 1 and 2 stay valid. The `questions.jsonl` format stays the same. A `raised` entry may now hold `{ type: 'general' }` as its `target`. Old logs stay readable.

The Question panel also reads a new `current` field from `watcher.json`. It holds the id of the Question the watcher is answering now, or `null`. The field is optional. An older `watcher.json` reads as `null`.

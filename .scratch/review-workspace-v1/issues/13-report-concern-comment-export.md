# 13 — Report / concern-comment export

**What to build:** Export of the Reviewer's accumulated Review State as a shareable report or as concern-comments (e.g. to paste into an MR), so review findings can leave the workspace without needing the workspace itself for distribution.

**Blocked by:** 10 — Questions & Review State persistence

**Status:** ready-for-agent

- [x] A full report can be generated summarizing Behavioral Groups, verification status, concerns, notes, and decision from the current Review State (`buildReport`, Markdown; groups ordered by declared `order`, understood/verified reported distinctly per group)
- [x] Concern-comments can be exported individually, each attributable to its originating Target (`buildConcernComment`/`buildConcernComments`; a Concern with no Target exports as a plain, unprefixed comment)
- [x] Export output is plain text/Markdown suitable for pasting into an external tool, with no dependency on the running server to view it afterward — `buildReport`/`buildConcernComments` are plain functions over `(document, state)`, independent of the server
- [x] Exporting is read-only with respect to the bundle — it does not require the write token and does not mutate `state.json` or `questions.jsonl` (verified: `GET /report` and `GET /concerns` are ungated, and `state.json` is asserted byte-identical before/after)
- [x] Wired into the running server as `GET /report` (`text/markdown`) and `GET /concerns` (JSON array of comment strings)

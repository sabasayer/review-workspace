# 10 — Questions & Review State persistence

**What to build:** App-owned, write-token-gated persistence for Questions (`questions.jsonl`, append-only) and Review State (`state.json`) — the two files the Generator never owns — so a Reviewer's questions and progress survive across sessions.

**Blocked by:** 08 — Local server: loopback binding + write-token enforcement

**Status:** ready-for-agent

- [x] Raising a Question against a Target appends an immutable record to `questions.jsonl`; existing records are never rewritten
- [x] Withdrawing a Question appends a withdrawal record and creates a replacement Question, rather than mutating or deleting the original
- [x] An Answer references exactly one Question and may cite Evidence; malformed Answers (no Question reference, or referencing >1 Question) are rejected — structurally enforced by the ticket-02 schema (`questionId` is a single required string field, not an array); additionally, an Answer whose `questionId` doesn't match any raised Question now surfaces as a `dangling-answer` Diagnostic (cross-references `questions.jsonl`, which the schema alone can't check)
- [x] Review State (progress, concerns, notes, verification status, decision) persists to `state.json` and survives a server restart (verified via a fresh read after write, and via the server's `/state` GET after a `PUT`)
- [x] Understanding and verification are tracked as distinct fields per Behavioral Group in Review State (not conflated into one status)
- [x] All of the above are gated behind the write token from ticket 08 (`POST /questions`, `POST /questions/:id/withdraw`, `PUT /state`; the corresponding `GET`s are read-only and ungated)

# 05 — Target resolution & Diagnostics

**What to build:** Resolution of every Target (File, Hunk, Line, Binary change) referenced by Annotations/Questions/Answers against the parsed patch, surfacing a visible Diagnostic for anything that fails to resolve instead of dropping it silently.

**Blocked by:** 04 — validateBundle: blocking-error gate

**Status:** ready-for-agent

- [x] File and Hunk Targets resolve against the parsed patch structure from ticket 03
- [x] Line Targets resolve by side + line number, and are flagged stale via a Diagnostic when their carried expected text no longer matches the patch
- [x] Binary-change Targets resolve against binary entries from the patch parser
- [x] A missing referenced asset under `assets/` produces a Diagnostic, not a crash or silent omission
- [x] An invalid optional field (e.g. malformed Annotation) produces a Diagnostic and the rest of the document still renders
- [x] Fixtures cover one case per Diagnostic class (stale line, missing asset, unresolved File/Hunk/Binary Target, invalid optional field)
- [x] `validateBundle` output now includes a non-empty `diagnostics[]` for these cases while `document` still returns valid content

# 04 — validateBundle: blocking-error gate

**What to build:** The `validateBundle(bundlePath)` seam that decides whether a bundle can be opened at all, enforcing only the four blocking conditions from the framework — everything else is deferred to later tickets and passes through as valid-with-possible-diagnostics.

**Blocked by:** 02 — Bundle schema, types & Comparison identity; 03 — Unified Patch parser

**Status:** ready-for-agent

- [x] Blocks opening when `review.json` cannot be parsed as JSON
- [x] Blocks opening when `schemaVersion` is unsupported by this engine version
- [x] Blocks opening when Comparison identity is missing
- [x] Blocks opening when `changes.diff` cannot be used (parser failure from ticket 03)
- [x] Any other condition (missing optional fields, unresolved Targets, missing assets) does NOT block — returns a valid document (deliberately hand-rolled checks here, not the strict ticket-02 ajv schema, so extra/malformed optional fields don't block; full schema-based Diagnostics land in ticket 05)
- [x] Fixtures cover one bundle per blocking condition plus one fully-valid bundle, asserting exact block/pass outcome per fixture
- [x] Function is pure: no network, no file writes, deterministic output for the same input path

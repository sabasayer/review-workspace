# 07 — CLI open/publish: atomic publish flow

**What to build:** The `review-workspace open <bundle>` and `review-workspace publish <bundle>` CLI commands implementing validate-then-atomic-publish, so a Generator's staged update either fully replaces `review.json` or leaves it untouched — never partially.

**Blocked by:** 04 — validateBundle: blocking-error gate

**Status:** ready-for-agent

- [x] `publish <bundle>` reads `review.next.json`, runs it through `validateBundle`, and atomically replaces `review.json` only on success
- [x] A failed `publish` (invalid schema, bad Targets) leaves the original `review.json` byte-for-byte unchanged and exits with a non-zero code
- [x] A successful `publish` exits zero and `review.json` matches the validated `review.next.json` content
- [x] `open <bundle>` on a bundle that fails the blocking gate (ticket 04) exits non-zero with a clear message; on a valid bundle it proceeds
- [x] Concurrent/interrupted publish attempts cannot leave `review.json` in a partially-written state — relies on `rename()`'s POSIX atomicity (write to a pid+timestamp-scoped temp file, then rename over `review.json`); not tested via simulated interruption since the guarantee comes from the syscall, not from our code — a kill-mid-write test would only prove the OS works

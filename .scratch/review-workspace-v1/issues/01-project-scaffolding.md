# 01 — Project scaffolding & synthetic fixture harness

**What to build:** A buildable, testable project skeleton with a conventions-based place to add synthetic Review Bundle fixtures, so every later ticket has somewhere to put code and tests from its first line.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [x] Package manifest, TypeScript (or chosen language) config, and test runner are set up and a trivial test passes
- [x] A `fixtures/` convention exists for synthetic Review Bundles (no real bundles ever committed, per ADR 0004)
- [x] Lint/format tooling runs clean on the empty skeleton (ponytail: `tsc --noEmit` doubles as lint; add a real linter only if type errors stop being sufficient signal)
- [x] README or CONTRIBUTING note explains how to add a new fixture bundle and run tests

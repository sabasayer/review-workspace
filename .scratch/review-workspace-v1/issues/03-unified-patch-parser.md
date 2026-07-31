# 03 — Unified Patch parser

**What to build:** A parser that turns the immutable `changes.diff` Unified Patch into structured files/hunks/lines, independent of any Review Document — so both the validator and the renderer can consume the same authoritative code evidence.

**Blocked by:** 01 — Project scaffolding & synthetic fixture harness

**Status:** ready-for-agent

- [x] Parses a Unified Patch into an ordered list of changed files, each with its hunks and lines (old/new line numbers, added/removed/context)
- [x] Handles binary change markers as a distinct entry type (not a hunk)
- [x] Rejects/flags an unparseable or truncated patch distinctly from a merely-empty patch (`PatchParseError`)
- [x] Fixture patches cover: single-file text change, multi-file change, a binary change, and a deliberately corrupt patch
- [x] Parser output preserves one logical code line per structural row (no line-merging), matching the framework's one-line-per-row rule

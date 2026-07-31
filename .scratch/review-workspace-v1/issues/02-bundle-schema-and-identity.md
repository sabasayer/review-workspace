# 02 — Bundle schema, types & Comparison identity

**What to build:** A versioned schema for the Review Document (`review.json`) that a Generator can target, with Comparison identity as a required, exact field — so any future bundle can declare "I am schemaVersion N describing exactly this base/head."

**Blocked by:** 01 — Project scaffolding & synthetic fixture harness

**Status:** ready-for-agent

- [x] Schema defines an integer `schemaVersion` and an exact, required Comparison identity (base/head revision references)
- [x] Schema defines the core collections: Behavioral Groups, Annotations, Evidence, Verification items and gaps, Answers — each optional except Comparison identity
- [x] Schema defines the four Target kinds (File, Hunk, Line-with-side-and-number-and-expected-text, Binary change) reusable across Annotations/Questions/Answers
- [x] A minimal fixture (Comparison identity + empty collections) validates against the schema
- [x] A fully-enriched fixture (every optional field populated) validates against the schema
- [x] Generated types (or equivalent) are available for consumers to import (`src/schema/types.ts`, hand-written to mirror the JSON Schema)

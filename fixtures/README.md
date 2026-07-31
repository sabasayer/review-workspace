# Fixtures

Synthetic Review Bundles only — never a real bundle (per ADR 0004: proprietary
code, screenshots, and reviewer notes must never enter this public repo).

To add a fixture, create a directory under `fixtures/` shaped like a real
Review Bundle (`review.json`, `changes.diff`, `questions.jsonl`, `state.json`,
`assets/`), populated with invented file names and diffs. Reference it from a
test by its directory name.

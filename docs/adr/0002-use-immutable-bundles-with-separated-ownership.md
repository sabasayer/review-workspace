# Use immutable bundles with separated ownership

One Review Bundle represents one exact base/head Comparison. The Generator owns the Review Document, the app owns Questions and Review State, and code evidence remains in the immutable Unified Patch; Generator updates are validated and atomically published. This avoids shared-file races, stale Targets after new commits, and accidental rewriting or omission of code evidence.

# Review Workspace

Review Workspace is a local decision surface for understanding, verifying, and deciding on a specific code comparison. Its language separates immutable code evidence, generated interpretation, and reviewer judgment.

## Language

**Review Workspace**:
The interactive decision surface through which a Reviewer examines a Review Bundle.
_Avoid_: Visual recap, generated review page, report viewer

**Review Bundle**:
The complete portable resource for reviewing one immutable Comparison, including its code evidence, interpretation, evidence assets, questions, and reviewer state.
_Avoid_: Resource file, review file, project

**Comparison**:
The exact base and head revisions whose differences are under review.
_Avoid_: Latest MR, current changes

**Review Document**:
The semantic interpretation of a Comparison produced and updated by a Generator.
_Avoid_: UI schema, layout document, generated HTML

**Unified Patch**:
The authoritative textual code difference for a Comparison.
_Avoid_: Review content, agent diff

**Generator**:
Anything capable of producing or updating a valid Review Document and its supporting bundle resources.
_Avoid_: AI, agent, model

**Reviewer**:
The single person examining a Review Bundle and recording their judgment.
_Avoid_: User, approver

**Behavioral Group**:
An ordered collection of related changes that together implement or verify one behavior.
_Avoid_: Folder, file group, section

**Annotation**:
A concise interpretation attached to a specific Target and supported by attributable evidence.
_Avoid_: Comment, tooltip, explanation badge

**Target**:
A typed reference to a file, hunk, line, or binary change in the Unified Patch.
_Avoid_: Anchor, selector, location string

**Evidence**:
An attributable observation relevant to intent, behavior, risk, or verification.
_Avoid_: AI claim, context

**Question**:
An immutable Reviewer request for clarification, optionally attached to a Target.
_Avoid_: Chat message, prompt

**Answer**:
A Generator-produced response to exactly one Question, with evidence references where applicable.
_Avoid_: Assistant reply, chat response

**Review State**:
The Reviewer's progress, concerns, notes, verification status, and decision for a Review Bundle.
_Avoid_: Agent state, session state

**Diagnostic**:
A visible problem found while validating or resolving Review Bundle content.
_Avoid_: Silent fallback, console error

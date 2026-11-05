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

**Comment**:
An item the Reviewer raises, optionally attached to a Target (code or general). It is either a Question or a Change-request.
_Avoid_: Annotation, chat message

**Question**:
An immutable Reviewer request for clarification. A follow-up is a new Question in the same Thread.
_Avoid_: Chat message, prompt

**Change-request**:
A Comment that asks the author of the Comparison to change something. The Generator never answers it. The Reviewer marks it fixed after the author's change. Its status label is "Fixed". The field name stays `resolved`.
_Avoid_: Fix request, task

**Answer**:
A Generator-produced response to exactly one Question, with evidence references where applicable.
_Avoid_: Assistant reply, chat response

**Thread**:
One line of questioning on a Target: the first Question, its Answers, and any follow-up Questions. It stays open until the Reviewer resolves it.
_Avoid_: Conversation, chat

**Intent**:
The plain-words statement of what a Comparison does, why, and what it does not do, with the source of each claim.
_Avoid_: Summary, description

**Review Brief**:
The facts the Reviewer gives the Generator at the start: the other Comparisons in the same stack, whether a person or an agent wrote the code, whether to answer Questions live, whether to start the app, and whether the agent checks the feature in the browser.
_Avoid_: Session context, settings

**Review State**:
The Reviewer's progress, concerns, notes, verification status, and decision for a Review Bundle.
_Avoid_: Agent state, session state

**Diagnostic**:
A visible problem found while validating or resolving Review Bundle content.
_Avoid_: Silent fallback, console error

**Before you read the code**:
The section above the diff. It holds the Intent, the findings with no code line (a general Target) and the "Start here" list.
_Avoid_: Summary, overview

**Visuals**:
The optional images in the Intent: images from the MR text and changed snapshot images from the diff, at most 3 shown. The agent's own app screenshots are not a source.
_Avoid_: Screenshots, attachments

**General Target**:
A Target that points at the whole Comparison. An Annotation uses it for a finding with no code line. A Comment uses it for a remark about the whole change. A general Comment is never stale. Only the Reviewer resolves it.
_Avoid_: Global note

**Live head**:
The newest commit of the MR on the server. The skill records it in `live-head.json` so the UI can warn that a new round is due.
_Avoid_: Latest, remote head

**Proof link**:
An Evidence item that links a code Target to an image that shows the change works. The UI shows it as an icon on the hunk or file header.
_Avoid_: Screenshot link, attachment

**Question panel**:
The docked side panel that holds every Question as a thread. Each thread shows the agent's state: waiting, answering or answered. It replaces the Question popover.
_Avoid_: Popover, chat window

**Preview**:
The small view that shows on hover over a file or code name in a note or finding. It shows a diff glimpse for a file in the diff and the top of the file for a file outside the diff.
_Avoid_: Tooltip, peek

# Separate generation from rendering

The Review Workspace is a deterministic renderer of a versioned semantic Review Bundle; generation is outside the product boundary. Generators produce domain concepts in schema-validated JSON and an authoritative Unified Patch rather than HTML, MDX, or UI component descriptions, so the same bundle renders safely and consistently regardless of which tool created it.

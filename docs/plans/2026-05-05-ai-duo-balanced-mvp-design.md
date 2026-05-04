# AI Duo Balanced MVP Design

**Date:** 2026-05-05
**Status:** Approved
**Source:** Revision of `PRD-v1-lean.md`

---

## Goal

Define a tighter, safer, and more buildable MVP for AI Duo Orchestrator without shrinking the core product vision.

The product remains a local orchestration layer for Claude Code and Codex inside Cursor or a VS Code-compatible extension. The value is not infinite AI-to-AI chat. The value is bounded multi-step workflows with explicit roles, artifact-first auditability, and safe recovery paths.

## Approved Scope

The approved MVP keeps all four flows:

- `claude-impl`
- `codex-impl`
- `dual-review`
- `dual-plan`
- `auto`

The release is tiered:

- `P0 release-critical`: `claude-impl`, `dual-review`, capability probe, structured control output, block UX, write safety
- `P1 same-release secondary`: `codex-impl`, `dual-plan`, bootstrap

Out of MVP:

- webview as primary UI
- cloud backend
- team workflows
- telemetry
- plugin packaging

## Key Design Decisions

### 1. Contract-first runner model

The extension must not hardcode CLI assumptions that were not verified. It should discover:

- command availability
- auth status
- non-interactive mode availability
- schema output support
- sandbox and permission capabilities

This capability map becomes the source of truth for runtime command construction.

### 2. Structured control output is mandatory

Each step produces:

- human-readable Markdown
- machine-readable control JSON

This removes fragile Markdown parsing from:

- verdict routing
- conditional skip logic
- combined verdict synthesis
- block UX
- release reporting

### 3. Reviewer write guarantees are asymmetric

The system must describe guarantees honestly:

- Codex reviewer can be hard-enforced read-only through sandbox
- Claude reviewer is best-effort no-write through permission and tool constraints

The product should not claim both are equally hard-enforced.

### 4. `needs-human-decision` pauses automation

`needs-human-decision` is not a softer `block`.

Meaning:

- `block`: technically actionable issue; automated fix pass may be attempted
- `needs-human-decision`: human judgment required; automated write continuation stops

### 5. Discard must be step-scoped, not tree-destructive

The product should not recommend `git checkout -- <files>` as a generic discard action.

Instead, each write step should record:

- pre-step state
- post-step delta patch
- reverse patch when derivable

Unsafe rollback should disable the discard affordance rather than pretending to be safe.

### 6. User edits become a write gate

User edits during a run are not just a warning. If a subsequent automated write would occur:

- read-only review steps may continue
- the next write step pauses for explicit user confirmation

This reduces clobber risk in implement-review-fix loops.

### 7. Untracked files must be review-visible

The previous spec risked hiding newly created files from review. The revised design requires:

- tracked diff capture
- explicit capture of untracked files when they are introduced by the run or already present in the selected review scope

## UX Direction

MVP stays Markdown-first.

Primary surfaces:

- command palette
- quick pick
- input box
- progress notifications
- output channel
- artifact links
- `.ai-duo/latest.md`

Webview is deferred.

Run states shown to users:

- `running`
- `paused-for-user-confirmation`
- `blocked`
- `needs-human-decision`
- `failed`
- `cancelled`
- `succeeded`

## Failure Model

Failures must be artifact-first and actionable. First-class failure classes:

- missing CLI
- missing auth
- capability mismatch
- git unavailable
- timeout
- non-zero exit
- schema parse failure
- reverse patch unavailable

Every failure should preserve partial logs and any partial control output that exists.

## Release Philosophy

The release decision should be based on whether the product is safe and useful in its core workflows, not on whether every supported flow has equal polish.

The MVP earns release if:

- `claude-impl` and `dual-review` are reliable
- runner capability detection works
- structured control JSON is stable
- write gating on user edits works
- unsafe discard is not exposed as safe
- stop states are legible to the user

## Notes

- No git repository was present in the workspace at design time, so this design doc could be saved locally but not committed.

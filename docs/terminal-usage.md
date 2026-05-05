# AI Duo Terminal Usage

## Launch

Open two terminals in the same repository.

Terminal 1:

```bash
npx aiduo claude
```

Terminal 2:

```bash
npx aiduo codex
```

AI Duo does not inject hidden defaults.

If you want Claude or Codex flags, pass them explicitly:

```bash
npx aiduo claude --resume
npx aiduo codex exec
npx aiduo codex exec --resume
```

## Slash Commands

Inside the wrapped Claude or Codex session:

```text
/aiduo:review
/aiduo:review --diff
/aiduo:review --all
/aiduo:implement
/aiduo:plan
/aiduo:fix
/aiduo:judge
/aiduo:status
/aiduo:latest
/aiduo:cancel
/aiduo:retry
/aiduo:bootstrap
/aiduo:help
```

## Common Flows

### Review the peer's latest message

In the current session:

```text
/aiduo:review
```

### Review the peer's latest message against the current diff

```text
/aiduo:review --diff
```

### Ask the current agent to implement the peer's latest plan

```text
/aiduo:implement
```

### Ask the current agent to produce a plan from the peer's latest request

```text
/aiduo:plan
```

## Artifacts

AI Duo writes local state and artifacts under:

```text
.ai-duo/runtime/
.ai-duo/runs/<run-id>/
.ai-duo/latest.md
```

## Top-Level Helpers

Outside the wrapped session:

```bash
npx aiduo help
npx aiduo status
npx aiduo latest
npx aiduo bootstrap
npx aiduo bootstrap --apply
```

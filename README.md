# AI Duo Orchestrator

AI Duo Orchestrator is a terminal-first wrapper for Claude and Codex sessions. You launch both agents through `aiduo`, then orchestrate them from inside the live sessions with `/aiduo:*` commands.

## Quick Start

After npm publish, the intended entrypoint is:

```bash
npx aiduo claude
npx aiduo codex
```

If you want to pass native Claude or Codex arguments, they go through unchanged:

```bash
npx aiduo claude --resume
npx aiduo claude --continue
npx aiduo codex exec
npx aiduo codex exec --resume
```

AI Duo does not inject hidden defaults. `claude`, `codex`, `--resume`, `exec`, and any other flags remain under your control.

## Session Workflow

1. Open two terminals in the same git repository.
2. Start Claude in one terminal.
3. Start Codex in the other terminal.
4. Keep talking to both agents normally.
5. When you want orchestration, use `/aiduo:*` inside the current wrapped session.

Example:

Terminal 1:

```bash
npx aiduo claude
```

Terminal 2:

```bash
npx aiduo codex
```

Inside one of those sessions:

```text
/aiduo:review --diff
```

## Slash Commands

Core commands:

- `/aiduo:review`
- `/aiduo:review --diff`
- `/aiduo:review --all`
- `/aiduo:implement`
- `/aiduo:plan`
- `/aiduo:fix`
- `/aiduo:judge`

Helper commands:

- `/aiduo:status`
- `/aiduo:latest`
- `/aiduo:cancel`
- `/aiduo:retry`
- `/aiduo:bootstrap`
- `/aiduo:help`

Common examples:

```text
/aiduo:review
/aiduo:review --diff
/aiduo:implement
/aiduo:plan
/aiduo:fix
/aiduo:judge
```

Detailed usage examples live in [terminal-usage.md](/Users/yajinn/Desktop/Projects/AIDuo/docs/terminal-usage.md).

## Top-Level Helper Commands

Outside the wrapped agent session, these commands are available:

```bash
npx aiduo help
npx aiduo status
npx aiduo latest
npx aiduo bootstrap
npx aiduo bootstrap --apply
```

These do not replace slash commands. They are repo-level helpers for setup, status, and artifacts.

## Artifacts and Runtime

AI Duo writes local state under:

```text
.ai-duo/runtime/
.ai-duo/runs/<run-id>/
.ai-duo/latest.md
```

What is stored there:

- session registry
- peer pairing state
- transcript events
- run metadata
- source context
- dispatched prompt
- captured response
- summaries

## Current Capabilities

- PTY wrappers for `claude` and `codex`
- file-backed session registry and transcript runtime
- slash-command parser for `/aiduo:*`
- artifact engine for `.ai-duo/runs/<id>`
- bootstrap preview and apply helpers
- prompt sanitization and secret redaction helpers
- transcript-backed context resolution with `--diff` and `--all`

## Current Limitations

- wrapper input is line-oriented, not full raw-terminal passthrough
- pairing is automatic by repo and latest opposite session; manual pairing flags are not added yet
- npm registry publish is still pending
- MCP sidecar and richer multi-session coordination are still future work

## Local Repo Usage

Before npm publish, you can still run it from this repo:

```bash
npm install
npm run build
npx --yes . help
npx --yes . claude
npx --yes . codex
```

GitHub source execution also works:

```bash
npx --yes github:yajinn/AIDuoOrchestrator help
```

Optional local global link:

```bash
npm link
aiduo help
aiduo claude
aiduo codex
```

## Local Development

```bash
npm install
npm test
npm run build
npm run lint
```

## Spec

The current terminal-first product direction is documented in [PRD-v3-terminal.md](/Users/yajinn/Desktop/Projects/AIDuo/PRD-v3-terminal.md).

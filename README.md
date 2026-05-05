# AI Duo Orchestrator

AI Duo Orchestrator is a terminal-first protocol and local runtime for Claude and Codex pair workflows.

## Current State

This repository currently contains a working terminal-first CLI foundation:

- `aiduo` CLI entrypoint with `claude` and `codex` wrapper commands
- file-backed session registry and transcript runtime under `.ai-duo/runtime`
- slash-command parser for `/aiduo:*`
- artifact engine for `.ai-duo/runs/<id>`
- bootstrap preview and apply helpers
- prompt sanitization and secret redaction helpers
- retained non-interactive orchestration modules and tests

## Current Focus

The current focus is the wrapper-driven terminal workflow described in [PRD-v3-terminal.md](/Users/yajinn/Desktop/Projects/AIDuo/PRD-v3-terminal.md).

## Install

Local development install:

```bash
npm install
npm run build
npx --yes . help
```

Direct GitHub `npx` usage after pushing:

```bash
npx --yes github:yajinn/AIDuoOrchestrator help
npx --yes github:yajinn/AIDuoOrchestrator bootstrap
```

After publishing the package, the intended registry form is:

```bash
npx aiduo help
npx aiduo claude --resume
npx aiduo codex exec
```

Optional global link for local use:

```bash
npm link
aiduo help
```

## What Works Today

- `aiduo claude ...` and `aiduo codex ...` PTY wrappers
- `/aiduo:review`, `/aiduo:implement`, `/aiduo:plan`, `/aiduo:fix`, `/aiduo:judge`
- `/aiduo:status`, `/aiduo:latest`, `/aiduo:cancel`, `/aiduo:retry`, `/aiduo:bootstrap`, `/aiduo:help`
- peer-session pairing within the same repo
- transcript-backed context resolution with `--diff` and `--all`
- run artifacts and `.ai-duo/latest.md`

## Current Limitations

- wrapper input is line-oriented, not full raw-terminal passthrough
- pairing is automatic by repo and latest opposite session; manual pairing flags are not added yet
- npm registry publish is still pending
- MCP sidecar and richer multi-session coordination are still future work

## Local Development

```bash
npm install
npm test
npm run build
npm run lint
```

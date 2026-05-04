# AI Duo Orchestrator

AI Duo Orchestrator is a local VS Code-compatible extension for bounded Claude Code and Codex workflows inside Cursor.

## Current State

This repository currently contains the MVP foundation:

- extension scaffold
- command registrations
- capability probe for Claude and Codex
- artifact engine for `.ai-duo/runs/<id>`
- structured control schema validation
- core flow state machines for `claude-impl` and `dual-review`
- prompt sanitization and secret redaction helpers
- Markdown summary rendering for stop states

## Commands

- `AI Duo: Run`
- `AI Duo: Review Current Diff`
- `AI Duo: Plan Debate`
- `AI Duo: Open Latest Timeline`
- `AI Duo: Bootstrap Project Rules`
- `AI Duo: Cancel Running Flow`

## What Works Today

- capability probe and flow support checks
- run scaffolding and artifact creation
- latest summary opening in the editor
- VSIX packaging

## Not Implemented Yet

- real Claude runner execution
- real Codex runner execution
- bootstrap file generation
- user edit filesystem watcher wiring
- reversal patch generation

## Local Development

```bash
npm install
npm test
npm run build
npm run lint
npm run package
```

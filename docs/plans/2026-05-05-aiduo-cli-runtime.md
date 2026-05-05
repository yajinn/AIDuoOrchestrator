# AI Duo CLI Runtime Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an installable `aiduo` CLI that wraps Claude and Codex sessions, records local runtime state, intercepts `/aiduo:*` commands, and can be distributed through `npm`/`npx`.

**Architecture:** Add a terminal-first CLI entrypoint and package `bin`, then layer a file-backed session runtime and slash-command dispatcher on top of the existing orchestration, bootstrap, artifact, and runner modules. Keep the interactive wrapper thin: spawn the agent process inside a PTY, proxy normal terminal I/O, intercept `/aiduo:*` lines locally, and persist session/run metadata under `.ai-duo/runtime`.

**Tech Stack:** TypeScript, Node.js, `node-pty`, Vitest

---

### Task 1: Add installable CLI packaging

**Files:**
- Modify: `package.json`
- Modify: `tsconfig.build.json`
- Create: `src/cli.ts`
- Test: `tests/cli.test.ts`

### Task 2: Add PTY-backed agent wrapper

**Files:**
- Create: `src/cli/wrapSession.ts`
- Create: `src/cli/stdio.ts`
- Test: `tests/wrapSession.test.ts`

### Task 3: Add file-backed session and transcript runtime

**Files:**
- Create: `src/runtime/sessions.ts`
- Create: `src/runtime/transcripts.ts`
- Create: `src/runtime/runs.ts`
- Test: `tests/runtimeSessions.test.ts`

### Task 4: Add slash-command parser and command handlers

**Files:**
- Create: `src/commands/parser.ts`
- Create: `src/commands/handlers.ts`
- Create: `src/context/resolver.ts`
- Test: `tests/commandParser.test.ts`
- Test: `tests/commandHandlers.test.ts`

### Task 5: Wire review/implement/plan/judge/fix/retry/bootstrap/status/latest

**Files:**
- Modify: `src/orchestrator.ts`
- Modify: `src/bootstrap.ts`
- Modify: `src/prompts.ts`
- Create: `src/runtime/pairing.ts`
- Test: `tests/commandHandlers.test.ts`
- Test: `tests/orchestrator.test.ts`

### Task 6: Validate packaging and local invocation

**Files:**
- Modify: `README.md`
- Test: `tests/cli.test.ts`


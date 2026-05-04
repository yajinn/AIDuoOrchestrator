# PRD.md — AI Duo Orchestrator for Cursor

**Doküman durumu:** Draft v1.0  
**Tarih:** 2026-05-04  
**Ürün adı:** AI Duo Orchestrator  
**Hedef platform:** Cursor, VS Code-compatible extension olarak MVP; Cursor Plugin paketleme V2  
**Birincil kullanıcı:** Solo developer / mobile app developer / indie builder  
**Ana amaç:** Claude Code ve Codex CLI’ı Cursor içinde kontrollü, dinamik rollere sahip iki-agent geliştirme workflow’una dönüştürmek.

---

## 1. Executive Summary

AI Duo Orchestrator, Cursor içinde çalışan bir extension olacak. Kullanıcı tek bir task girer, extension ise task tipine göre Claude Code ve Codex CLI arasında kontrollü bir workflow başlatır.

Temel fikir:

```text
Kullanıcı task girer
↓
Extension flow ve rolleri seçer veya kullanıcı seçer
↓
Claude ve Codex CLI sırayla çalıştırılır
↓
Her agent’ın cevabı, diff’i ve review sonucu run klasörüne yazılır
↓
Cursor içinde timeline panelinde gösterilir
↓
Final verdict / fix plan / implementation summary üretilir
```

Default workflow:

```text
Claude = implementer
Codex = reviewer / acımasız gatekeeper
```

Alternatif workflow’lar:

```text
Codex = implementer
Claude = reviewer

Claude + Codex = dual reviewer

Claude + Codex = dual planner + cross-review + final plan
```

Ürün, iki AI’ı sınırsız sohbet ettirmez. Bunun yerine net step sınırları olan, artifact üreten, debug edilebilir, tekrar çalıştırılabilir bir orchestration katmanı sağlar.

---

## 2. Problem Statement

Kullanıcı Cursor’da development yaparken hem Codex CLI hem Claude Code CLI kullanıyor. İki modelin güçlü yanlarından birlikte yararlanmak istiyor:

- Claude Code’un implementation ve skill workflow kabiliyeti.
- Codex’in güçlü reviewer, risk analizi ve codebase reasoning kabiliyeti.
- İki modelin birbirlerinin planlarını, cevaplarını ve diff’lerini görüp yorumlaması.
- Kimin implementer, kimin reviewer olacağının task’a göre dinamik seçilmesi.
- Bazı durumlarda ikisinin de reviewer veya planner olması.

Mevcut manuel akış problemli:

```text
1. Claude’dan cevap al
2. Cevabı kopyala
3. Codex’e yapıştır
4. Codex review’ını kopyala
5. Claude’a geri yapıştır
6. Diff’i manuel kontrol et
7. Hangi agent ne dedi takip etmeye çalış
```

Bu süreç:

- yavaş,
- hata açık,
- context kaybına müsait,
- terminal ve chat geçmişi içinde dağınık,
- tekrar edilemez,
- güvenlik sınırları belirsiz,
- token israfına açık.

AI Duo Orchestrator bu süreci ürünleştirir.

---

## 3. Goals

### 3.1 Primary Goals

1. Cursor içinde Claude Code ve Codex CLI’ı tek komutla orkestre etmek.
2. Kullanıcının flow seçebilmesini sağlamak:
   - Claude implementer → Codex reviewer.
   - Codex implementer → Claude reviewer.
   - Dual reviewer.
   - Dual planner + cross-review.
   - Auto router.
3. Her agent output’unu dosyaya kaydetmek.
4. Her run için artifact üretmek:
   - task,
   - agent cevapları,
   - git diff snapshot’ları,
   - reviewer verdict’leri,
   - final summary.
5. Cursor içinde okunabilir timeline paneli sunmak.
6. Reviewer rolünde çalışan agent’ın dosya yazmasını engellemek.
7. Implementer rolünde çalışan agent’a sınırlı, kontrollü write izni vermek.
8. Claude skills ve Codex AGENTS.md yönergelerini bootstrap etmek.
9. Kullanıcıya hızlı ama denetlenebilir bir AI pair programming workflow’u vermek.

### 3.2 Secondary Goals

1. Run geçmişini saklamak.
2. Son run’dan devam edebilmek.
3. Mevcut git diff’i iki modele bağımsız review ettirebilmek.
4. Selected files / active editor context’i prompt’a dahil edebilmek.
5. Prompt template’leri proje bazlı özelleştirmek.
6. Flow kararını neden seçtiğini kullanıcıya göstermek.
7. Tek tıkla `.ai-duo/latest.md` dosyasını açmak.
8. Hatalı CLI kurulumu, auth yokluğu veya permission problemi için actionable hata mesajı vermek.

---

## 4. Non-Goals

MVP’de yapılmayacaklar:

1. Cursor’ın kendi chat UI’ını veya internal agent panelini okumak/yazmak.
2. Claude ve Codex’i sonsuz konuşma döngüsüne sokmak.
3. Cloud-based orchestration backend kurmak.
4. Kullanıcının kodunu üçüncü bir backend’e göndermek.
5. Agent output’larını otomatik commit etmek.
6. Production dependency eklemeyi otomatik onaylamak.
7. `--yolo`, `danger-full-access`, `bypassPermissions`, `dangerously-skip-permissions` gibi modları default kullanmak.
8. Tüm PR review sürecini GitHub/GitLab ile entegre etmek.
9. Full task management sistemi yapmak.
10. Multi-user/team collaboration desteklemek.

---

## 5. Product Principles

### 5.1 Control stays with user

Agent’lar kendi aralarında sınırsız karar vermemeli. Flow, step sayısı, write permission ve final gate extension tarafından kontrol edilmeli.

### 5.2 Reviewer cannot write

Reviewer rolündeki agent’ın filesystem write yapması engellenmeli. Reviewer yalnızca değerlendirme, risk, test ve verdict üretmeli.

### 5.3 Every run is auditable

Her AI cevabı, diff snapshot’ı ve final karar dosyaya yazılmalı. Kullanıcı sonradan “kim ne dedi, ne değişti?” sorusunun cevabını görebilmeli.

### 5.4 Terminal output is not source of truth

Terminal scrollback değil, structured artifacts kaynak olmalı:

```text
.ai-duo/runs/<run-id>/
```

### 5.5 Small bounded workflows

AI’lar maksimum 4–5 step içinde sonuç üretmeli. Daha uzun loop token yakar ve karar kalitesini düşürür.

### 5.6 No hidden magic

Auto router bir flow seçerse neden seçtiğini göstermeli. Kullanıcı isterse flow’u manuel override edebilmeli.

---

## 6. Users and Personas

### 6.1 Primary Persona: Solo Mobile Developer

- Cursor kullanır.
- Flutter, React Native, Swift, Kotlin veya backend API geliştirir.
- Claude Code ve Codex CLI’ı terminalden kullanır.
- Hızlı implementasyon ister ama production bug’larından korkar.
- Özellikle auth, payment, offline sync, push notification, state management, cache ve API integration gibi konularda ikinci bir AI review ister.

### 6.2 Secondary Persona: Indie SaaS Developer

- Full-stack çalışır.
- Feature geliştirme, refactor ve bug fix yapar.
- PR açmadan önce iki modelden review almak ister.

### 6.3 Future Persona: Small Team Tech Lead

- Takımın AI workflow’unu standardize etmek ister.
- Prompt template, review checklist ve agent rules’larını repo içinde paylaşmak ister.

---

## 7. Core Use Cases

### 7.1 Claude implements, Codex reviews

Kullanıcı:

```text
AI Duo: Run
Task: Refresh token race condition bug'ını mobile app için düzelt.
Flow: Claude implementer → Codex reviewer
```

Beklenen akış:

```text
1. Claude task’ı implement eder.
2. Extension git diff snapshot alır.
3. Codex diff’i ve Claude özetini review eder.
4. Claude valid review maddelerini düzeltir.
5. Codex final gate verir.
6. Timeline açılır.
```

### 7.2 Codex implements, Claude reviews

Kullanıcı:

```text
Flow: Codex implementer → Claude reviewer
Task: Profile screen loading state bug'ını düzelt.
```

Beklenen akış:

```text
1. Codex implement eder.
2. Claude diff review yapar.
3. Optional: Codex fix pass.
4. Claude final verdict verir.
```

### 7.3 Dual reviewer

Kullanıcı mevcut değişiklikleri yaptıktan sonra:

```text
AI Duo: Review Current Diff
```

Beklenen akış:

```text
1. Extension git diff alır.
2. Codex reviewer olarak bağımsız review yapar.
3. Claude reviewer olarak bağımsız review yapar.
4. Extension veya final judge birleşik risk raporu üretir.
```

### 7.4 Dual planner + cross-review

Kullanıcı:

```text
Task: Offline-first sync mimarisi nasıl olmalı?
Flow: Dual planner
```

Beklenen akış:

```text
1. Claude plan üretir.
2. Codex ayrı plan üretir.
3. Claude Codex planını eleştirir.
4. Codex Claude planını eleştirir.
5. Final merged plan üretilir.
6. Hiçbir dosya editlenmez.
```

### 7.5 Auto router

Kullanıcı sadece task yazar:

```text
Task: Login flow'daki token refresh bug'ını düzelt.
```

Router:

```text
Selected flow: claude-impl
Reason: Task implementation/fix gibi görünüyor.
```

Kullanıcı flow’u değiştirebilir.

---

## 8. MVP Scope

### 8.1 MVP Features

#### Commands

Command Palette komutları:

```text
AI Duo: Run
AI Duo: Plan Debate
AI Duo: Review Current Diff
AI Duo: Open Latest Timeline
AI Duo: Bootstrap Project Rules
AI Duo: Open Settings
AI Duo: Cancel Running Flow
```

#### Flow selection

`AI Duo: Run` içinde Quick Pick:

```text
Auto
Claude implementer → Codex reviewer
Codex implementer → Claude reviewer
Both reviewers
Both planners → cross-review → final plan
Review current git diff only
```

#### Task input

Input Box:

```text
Describe the task, bug, feature, architecture question, or review goal.
```

#### Run artifacts

Her run şu klasöre yazılır:

```text
.ai-duo/runs/YYYYMMDD-HHMMSS/
```

#### Latest file

```text
.ai-duo/latest.md
```

#### Timeline panel

MVP’de iki seçenekten biri yeterlidir:

1. Markdown preview açmak.
2. Basit Webview panel göstermek.

MVP için öneri:

```text
Önce Markdown preview.
Sonra Webview.
```

#### CLI validation

Extension açıldığında veya ilk run’da şunları kontrol eder:

```bash
claude --version
codex --version
git --version
```

Gerekiyorsa:

```bash
claude auth status
```

Codex auth doğrulaması CLI behavior’a göre yapılır; başarısız run stderr üzerinden actionable hata verir.

#### Project bootstrap

`AI Duo: Bootstrap Project Rules` şunları ekler:

```text
.ai-duo/config.json
.ai-duo/prompts/*.md
.claude/skills/duo-implementer/SKILL.md
.claude/skills/duo-reviewer/SKILL.md
.claude/skills/duo-planner/SKILL.md
AGENTS.md bölümü
CLAUDE.md bölümü
.gitignore içine .ai-duo/
```

Bootstrap işleminden önce preview gösterilmeli.

---

## 9. Out of Scope for MVP

1. GitHub PR comment publishing.
2. Team dashboard.
3. Cloud sync.
4. Multi-repo orchestration.
5. Remote containers özel desteği.
6. JetBrains plugin.
7. Cursor Marketplace plugin packaging.
8. MCP server discovery UI.
9. Full prompt marketplace.
10. Cost dashboard.

---

## 10. Functional Requirements

### FR-001 — Run command

Extension kullanıcıya Command Palette üzerinden `AI Duo: Run` komutu sunmalı.

Acceptance criteria:

- Komut çalışınca flow Quick Pick açılır.
- Kullanıcı flow seçebilir.
- Kullanıcı task yazabilir.
- Run başlar ve progress gösterilir.
- Run sonunda `.ai-duo/latest.md` açılır.

### FR-002 — Dynamic flow selection

Extension `auto` flow seçildiğinde task metni ve git state’e göre flow belirlemeli.

Heuristic MVP:

```text
Task contains: implement, fix, düzelt, ekle, refactor, bug, build
→ claude-impl

Task contains: review, audit, security, güvenlik, risk, kontrol, production'a girebilir mi
→ dual-review

Task contains: plan, mimari, architecture, tasarım, strategy, roadmap, nasıl olmalı
→ dual-plan

Git diff exists + task short or review-like
→ dual-review

Default
→ claude-impl
```

Acceptance criteria:

- Router seçtiği flow’u ve nedenini gösterir.
- Kullanıcı flow’u override edebilir.

### FR-003 — Claude implementer flow

Flow ID:

```text
claude-impl
```

Steps:

```text
1. Claude implementer writes code.
2. Extension captures diff.
3. Codex reviewer reviews diff.
4. Claude fix pass applies valid feedback.
5. Extension captures final diff.
6. Codex final gate.
```

Acceptance criteria:

- Claude step’i write permission ile çalışır.
- Codex review step’i read-only çalışır.
- Review output `.md` dosyasına yazılır.
- Final gate `approve` veya `block` verdict üretir.

### FR-004 — Codex implementer flow

Flow ID:

```text
codex-impl
```

Steps:

```text
1. Codex implementer writes code.
2. Extension captures diff.
3. Claude reviewer reviews diff.
4. Optional Codex fix pass.
5. Claude final gate.
```

MVP’de optional fix pass kapalı olabilir. V1.1’de ayara bağlanır.

Acceptance criteria:

- Codex implementer `workspace-write` sandbox ile çalışır.
- Claude reviewer `plan` permission mode ile çalışır.

### FR-005 — Dual review flow

Flow ID:

```text
dual-review
```

Steps:

```text
1. Capture current git diff.
2. Codex reviewer review.
3. Claude reviewer review.
4. Final synthesis.
```

Final synthesis MVP’de Claude veya extension template ile yapılabilir.

Acceptance criteria:

- Her iki agent aynı diff’i görür.
- İki review ayrı dosyalara yazılır.
- Combined report must-fix / should-fix / tests / verdict içerir.

### FR-006 — Dual plan flow

Flow ID:

```text
dual-plan
```

Steps:

```text
1. Claude planner produces plan.
2. Codex planner produces plan.
3. Claude reviews Codex plan.
4. Codex reviews Claude plan.
5. Final merged plan.
```

Acceptance criteria:

- Hiçbir step dosya edit yetkisi almaz.
- Final plan risky assumptions, implementation sequence, tests ve open questions içerir.
- Cross-review artifact’leri ayrı dosyaya yazılır.

### FR-007 — Artifacts

Her run şu dosyaları üretmeli.

Common:

```text
00-task.md
00-meta.json
00-git-status.txt
latest-step.txt
```

Claude implementer flow:

```text
01-claude-implementation.md
02-diff-after-claude.patch
03-codex-review.md
04-claude-fix.md
05-diff-after-fix.patch
06-codex-final-gate.md
summary.md
```

Dual plan flow:

```text
01-claude-plan.md
02-codex-plan.md
03-claude-reviews-codex.md
04-codex-reviews-claude.md
05-final-plan.md
summary.md
```

Dual review flow:

```text
01-current-diff.patch
02-codex-review.md
03-claude-review.md
04-combined-review.md
summary.md
```

Acceptance criteria:

- `.ai-duo/latest.md` her run sonunda güncellenir.
- Run directory tek başına incelenebilir olmalı.

### FR-008 — Timeline panel

Timeline şu bölümleri göstermeli:

```text
Run metadata
Task
Selected flow
Step status
Agent outputs
Diff snapshots
Final verdict
Suggested next commands
```

Acceptance criteria:

- Kullanıcı run devam ederken progress görebilir.
- Run bitince final summary en üstte görünür.
- Her artifact tek tıkla açılabilir.

### FR-009 — Bootstrap project rules

Bootstrap komutu aşağıdaki dosyaları oluşturmalı veya patchlemeli:

```text
.ai-duo/config.json
.ai-duo/prompts/claude-implementer.md
.ai-duo/prompts/claude-reviewer.md
.ai-duo/prompts/claude-planner.md
.ai-duo/prompts/codex-implementer.md
.ai-duo/prompts/codex-reviewer.md
.ai-duo/prompts/codex-planner.md
.claude/skills/duo-implementer/SKILL.md
.claude/skills/duo-reviewer/SKILL.md
.claude/skills/duo-planner/SKILL.md
AGENTS.md
CLAUDE.md
.gitignore
```

Acceptance criteria:

- Mevcut dosyalar overwrite edilmez.
- Eklenen bloklar marker ile işaretlenir:

```md
<!-- AI_DUO_START -->
...
<!-- AI_DUO_END -->
```

- Kullanıcı patch preview görür.

### FR-010 — Cancellation

Kullanıcı çalışan flow’u iptal edebilmeli.

Acceptance criteria:

- Extension child process’leri terminate eder.
- Partial artifact’ler korunur.
- `summary.md` içine run’ın iptal edildiği yazılır.

---

## 11. Non-Functional Requirements

### NFR-001 — Security

- `.ai-duo/` default `.gitignore` içinde olmalı.
- Reviewer modlarında filesystem write engellenmeli.
- Dangerous permission modları default kapalı olmalı.
- Bootstrap edilen skill’lerde `allowed-tools` minimum olmalı.
- Secrets redaction yapılmalı.

### NFR-002 — Reliability

- Her step timeout desteklemeli.
- CLI exit code kontrol edilmeli.
- Stderr artifact olarak saklanmalı.
- Partial output kaybolmamalı.

### NFR-003 — Performance

- Extension UI thread bloklanmamalı.
- CLI process’ler async spawn edilmeli.
- Büyük diff’lerde prompt truncation uygulanmalı.

### NFR-004 — Privacy

- Ürün backend’e veri göndermemeli.
- Tüm agent çağrıları kullanıcının kendi local Claude/Codex CLI auth’ı üzerinden gitmeli.
- Telemetry MVP’de kapalı olmalı.

### NFR-005 — Portability

Desteklenen ortamlar:

```text
macOS
Linux
WSL
```

Windows native V1.1 hedefidir. Çünkü shell quoting, path ve CLI behavior daha fazla edge case üretir.

---

## 12. System Architecture

### 12.1 High-level architecture

```text
Cursor / VS Code Extension Host
│
├── Commands
│   ├── AI Duo: Run
│   ├── AI Duo: Review Current Diff
│   ├── AI Duo: Plan Debate
│   ├── AI Duo: Bootstrap Project Rules
│   └── AI Duo: Open Latest Timeline
│
├── Flow Engine
│   ├── Router
│   ├── Step Executor
│   ├── Artifact Manager
│   ├── Git Snapshot Manager
│   └── Safety Guard
│
├── Agent Runners
│   ├── ClaudeRunner
│   └── CodexRunner
│
├── UI
│   ├── Quick Pick
│   ├── Input Box
│   ├── Output Channel
│   └── Timeline Webview / Markdown Preview
│
└── Workspace Files
    ├── .ai-duo/
    ├── .claude/skills/
    ├── AGENTS.md
    └── CLAUDE.md
```

### 12.2 Why extension instead of terminal hack

Do not read interactive terminal scrollback as primary data.

Reasons:

- TUI output is noisy.
- ANSI/progress output pollutes context.
- Terminal history misses file changes.
- It is difficult to parse reliably.
- It creates security and secret leakage risk.

Use file artifacts and git diff snapshots instead.

---

## 13. Technical Design

### 13.1 Extension tech stack

```text
Language: TypeScript
Runtime: VS Code Extension Host / Node.js
Package manager: pnpm or npm
Build: esbuild or tsc
Test: @vscode/test-electron + vitest/jest for pure functions
Packaging: vsce / manual VSIX for Cursor install
```

### 13.2 Main modules

```text
src/extension.ts
src/commands.ts
src/flows.ts
src/router.ts
src/runners/claudeRunner.ts
src/runners/codexRunner.ts
src/artifacts.ts
src/git.ts
src/bootstrap.ts
src/webview.ts
src/config.ts
src/security/redaction.ts
src/utils/process.ts
```

### 13.3 Type model

```ts
type Agent = "claude" | "codex";

type Role =
  | "implementer"
  | "reviewer"
  | "planner"
  | "fixer"
  | "finalJudge";

type FlowId =
  | "auto"
  | "claude-impl"
  | "codex-impl"
  | "dual-review"
  | "dual-plan";

type PermissionMode =
  | "read"
  | "write";

type StepStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

interface FlowStep {
  id: string;
  label: string;
  agent: Agent;
  role: Role;
  permission: PermissionMode;
  inputFiles: string[];
  outputFile: string;
  captureDiffBefore?: boolean;
  captureDiffAfter?: boolean;
  required?: boolean;
}

interface RunMeta {
  id: string;
  startedAt: string;
  finishedAt?: string;
  workspaceRoot: string;
  flowId: FlowId;
  selectedBy: "user" | "auto";
  routerReason?: string;
  task: string;
  status: StepStatus;
  steps: Array<{
    id: string;
    status: StepStatus;
    startedAt?: string;
    finishedAt?: string;
    exitCode?: number;
    outputFile?: string;
    errorFile?: string;
  }>;
}
```

---

## 14. Flow Definitions

### 14.1 Flow: `claude-impl`

```text
Purpose:
Use Claude Code as implementer and Codex as adversarial reviewer.
```

Step table:

| Step | Agent | Role | Permission | Output |
|---|---|---|---|---|
| 1 | Claude | implementer | write | `01-claude-implementation.md` |
| 2 | System | diff capture | read | `02-diff-after-claude.patch` |
| 3 | Codex | reviewer | read | `03-codex-review.md` |
| 4 | Claude | fixer | write | `04-claude-fix.md` |
| 5 | System | diff capture | read | `05-diff-after-fix.patch` |
| 6 | Codex | finalJudge | read | `06-codex-final-gate.md` |
| 7 | System | summary | read | `summary.md` |

CLI mapping:

```bash
claude -p "$PROMPT" \
  --permission-mode acceptEdits \
  --output-format json \
  --max-turns 12
```

```bash
codex exec \
  --sandbox read-only \
  --ask-for-approval never \
  --output-last-message "$OUT" \
  -
```

### 14.2 Flow: `codex-impl`

| Step | Agent | Role | Permission | Output |
|---|---|---|---|---|
| 1 | Codex | implementer | write | `01-codex-implementation.md` |
| 2 | System | diff capture | read | `02-diff-after-codex.patch` |
| 3 | Claude | reviewer | read | `03-claude-review.md` |
| 4 | Codex | fixer | write | `04-codex-fix.md` |
| 5 | Claude | finalJudge | read | `05-claude-final-gate.md` |

CLI mapping:

```bash
codex exec \
  --sandbox workspace-write \
  --ask-for-approval on-request \
  --output-last-message "$OUT" \
  -
```

```bash
claude -p "$PROMPT" \
  --permission-mode plan \
  --output-format json \
  --max-turns 6
```

### 14.3 Flow: `dual-review`

| Step | Agent | Role | Permission | Output |
|---|---|---|---|---|
| 1 | System | diff capture | read | `01-current-diff.patch` |
| 2 | Codex | reviewer | read | `02-codex-review.md` |
| 3 | Claude | reviewer | read | `03-claude-review.md` |
| 4 | Claude or System | finalJudge | read | `04-combined-review.md` |

Rules:

- Codex and Claude can run sequentially in MVP.
- V1.1 can run them parallel because both are read-only.
- Combined report must deduplicate findings.

### 14.4 Flow: `dual-plan`

| Step | Agent | Role | Permission | Output |
|---|---|---|---|---|
| 1 | Claude | planner | read | `01-claude-plan.md` |
| 2 | Codex | planner | read | `02-codex-plan.md` |
| 3 | Claude | reviewer | read | `03-claude-reviews-codex.md` |
| 4 | Codex | reviewer | read | `04-codex-reviews-claude.md` |
| 5 | Claude or selected final judge | finalJudge | read | `05-final-plan.md` |

Rules:

- No code edits.
- Plan should include affected files, implementation order, edge cases, test plan, risks and explicit rejected ideas.

---

## 15. Prompt Strategy

### 15.1 Prompt template hierarchy

Default prompt templates live in extension package. On bootstrap they are copied to:

```text
.ai-duo/prompts/
```

Resolution order:

```text
1. Workspace .ai-duo/prompts/<name>.md
2. Extension built-in prompt
```

This lets user customize per project.

### 15.2 Shared prompt rules

All agent prompts include:

```text
- Role
- Task
- Input artifacts
- Current git status
- Relevant diff
- Permission boundary
- Output schema
- No fake test claims
```

### 15.3 Reviewer output format

```md
# Review

## Verdict
approve | block

## Must fix
1. ...

## Should fix
1. ...

## Looks okay
- ...

## Missing tests
- ...

## Risky assumptions
- ...

## Suggested commands
```bash
...
```
```

### 15.4 Implementer output format

```md
# Implementation Summary

## Files changed
- path: reason

## What changed
- ...

## Commands run
```bash
...
```

## Tests
- Passed:
- Not run:

## Risks
- ...

## Reviewer should attack
- ...
```

### 15.5 Planner output format

```md
# Plan

## Recommended approach
...

## Affected files
- ...

## Implementation sequence
1. ...

## Edge cases
- ...

## Test plan
- ...

## Risks
- ...

## What the other agent should challenge
- ...
```

---

## 16. Claude Skills Strategy

### 16.1 Why skills

Claude skills are useful for reusable procedures such as:

```text
- implement feature
- review diff
- plan architecture
- fix from review
```

The extension should support Claude skills, but should not depend exclusively on interactive slash invocation. Non-interactive extension calls should still work by injecting equivalent prompt templates.

### 16.2 Bootstrap project skills

Create:

```text
.claude/skills/duo-implementer/SKILL.md
.claude/skills/duo-reviewer/SKILL.md
.claude/skills/duo-planner/SKILL.md
.claude/skills/duo-fix-from-review/SKILL.md
```

### 16.3 Skill frontmatter baseline

```yaml
---
name: duo-reviewer
description: Review the current AI Duo task, peer output, and git diff. Use for adversarial code review.
disable-model-invocation: true
allowed-tools:
  - Read
  - Bash(git status *)
  - Bash(git diff *)
  - Bash(git grep *)
---
```

Important security note:

- `allowed-tools` pre-approves tools while the skill is active.
- It does not restrict all other tools by itself.
- Restriction should be enforced by CLI permission mode and project settings where possible.

### 16.4 Dynamic context injection

Skills may include:

```md
## Current diff

!`git diff`
```

But extension should also pass diff artifacts explicitly, because dynamic shell context may be disabled by policy or behave differently across environments.

---

## 17. Codex AGENTS.md Strategy

Bootstrap should append a bounded AI Duo section to `AGENTS.md`:

```md
<!-- AI_DUO_START -->
## AI Duo protocol

When prompt says `ROLE: reviewer`:
- Do not edit files.
- Review the peer output and actual git diff.
- Separate findings into Must fix, Should fix, Looks okay, Suggested tests, Final verdict.
- Be concrete and adversarial.

When prompt says `ROLE: implementer`:
- Make the smallest safe change.
- Do not ignore reviewer feedback.
- Do not claim tests passed unless actually run.
<!-- AI_DUO_END -->
```

Rules:

- Existing `AGENTS.md` content must not be overwritten.
- If AI Duo block exists, update only inside markers.

---

## 18. CLAUDE.md Strategy

Bootstrap should append a bounded section to `CLAUDE.md`:

```md
<!-- AI_DUO_START -->
## AI Duo protocol

When acting as implementer:
- Make the smallest correct change.
- Avoid unrelated refactors.
- Summarize files changed, commands run, tests and risks.

When acting as reviewer:
- Do not edit files.
- Be harsh on correctness, edge cases, security, maintainability and tests.

When acting as planner:
- Do not edit files.
- Produce implementation sequence, risks, affected files and test plan.
<!-- AI_DUO_END -->
```

---

## 19. Configuration

### 19.1 Workspace config

File:

```text
.ai-duo/config.json
```

Schema:

```json
{
  "version": 1,
  "defaultFlow": "auto",
  "defaultImplementer": "claude",
  "defaultReviewer": "codex",
  "defaultFinalJudge": "claude",
  "plannerFinalJudge": "claude",
  "openTimelineAfterRun": true,
  "useWebview": false,
  "maxTurns": {
    "claudeImplementer": 12,
    "claudeReviewer": 6,
    "claudePlanner": 6,
    "codexImplementer": 12,
    "codexReviewer": 6,
    "codexPlanner": 6
  },
  "timeoutsSeconds": {
    "implementer": 900,
    "reviewer": 600,
    "planner": 600,
    "finalJudge": 300
  },
  "diff": {
    "maxBytes": 200000,
    "includeUntrackedFiles": false
  },
  "safety": {
    "blockDangerousModes": true,
    "requireCleanGitBeforeWriteFlow": false,
    "redactSecrets": true,
    "writeReviewerReadOnly": true
  },
  "cli": {
    "claudePath": "claude",
    "codexPath": "codex",
    "gitPath": "git"
  }
}
```

### 19.2 VS Code settings

Expose these settings:

```json
{
  "aiDuo.defaultFlow": "auto",
  "aiDuo.claudePath": "claude",
  "aiDuo.codexPath": "codex",
  "aiDuo.openTimelineAfterRun": true,
  "aiDuo.useWebview": false,
  "aiDuo.maxDiffBytes": 200000,
  "aiDuo.requireCleanGitBeforeWriteFlow": false
}
```

Workspace config overrides extension defaults. VS Code settings override built-in defaults if workspace config does not exist.

---

## 20. CLI Integration Details

### 20.1 Claude runner

Reviewer/planner mode:

```bash
claude -p "$PROMPT" \
  --permission-mode plan \
  --output-format json \
  --max-turns 6
```

Implementer/fixer mode:

```bash
claude -p "$PROMPT" \
  --permission-mode acceptEdits \
  --output-format json \
  --max-turns 12
```

Recommended optional flags:

```bash
--append-system-prompt-file .ai-duo/prompts/claude-<role>.system.md
```

Do not use for skill-dependent flows:

```bash
--bare
```

Reason: bare mode skips discovery of skills, plugins, hooks and CLAUDE.md.

### 20.2 Codex runner

Reviewer/planner mode:

```bash
codex exec \
  --sandbox read-only \
  --ask-for-approval never \
  --output-last-message "$OUT" \
  -
```

Implementer/fixer mode:

```bash
codex exec \
  --sandbox workspace-write \
  --ask-for-approval on-request \
  --output-last-message "$OUT" \
  -
```

Never default to:

```bash
--dangerously-bypass-approvals-and-sandbox
--yolo
--sandbox danger-full-access
```

### 20.3 Process execution

Use Node `child_process.spawn`, not `exec`, to avoid buffer limits.

Requirements:

- stream stdout to output channel,
- stream stderr to `.stderr.log`,
- write final output file,
- support cancellation,
- support timeout,
- preserve partial outputs.

Pseudo-code:

```ts
async function runProcess(command: string, args: string[], options: RunOptions) {
  const controller = new AbortController();
  const proc = spawn(command, args, {
    cwd: options.cwd,
    env: options.env,
    signal: controller.signal,
    shell: false
  });

  proc.stdout.on("data", chunk => appendStdout(chunk));
  proc.stderr.on("data", chunk => appendStderr(chunk));

  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  const exitCode = await waitForExit(proc);
  clearTimeout(timeout);
  return exitCode;
}
```

---

## 21. Git Integration

### 21.1 Commands

```bash
git status --short
git diff --stat
git diff
git ls-files --others --exclude-standard
```

### 21.2 Diff handling

For large diffs:

```text
If git diff > maxDiffBytes:
  1. Write full diff to artifact.
  2. Include diff stat in prompt.
  3. Include truncated diff with explicit warning.
  4. Ask agent to mention that full diff was too large.
```

### 21.3 Dirty working tree warning

Before write flows:

```text
If uncommitted changes exist:
  Show warning.
  Options:
    - Continue
    - Cancel
    - Review current diff first
```

If config `requireCleanGitBeforeWriteFlow = true`, block write flows until clean.

---

## 22. UI / UX Requirements

### 22.1 Command palette commands

```json
{
  "contributes": {
    "commands": [
      { "command": "aiDuo.run", "title": "AI Duo: Run" },
      { "command": "aiDuo.planDebate", "title": "AI Duo: Plan Debate" },
      { "command": "aiDuo.reviewCurrentDiff", "title": "AI Duo: Review Current Diff" },
      { "command": "aiDuo.openLatestTimeline", "title": "AI Duo: Open Latest Timeline" },
      { "command": "aiDuo.bootstrapProjectRules", "title": "AI Duo: Bootstrap Project Rules" },
      { "command": "aiDuo.cancel", "title": "AI Duo: Cancel Running Flow" }
    ]
  }
}
```

### 22.2 Flow picker

Quick Pick options:

```text
Auto
Claude implementer → Codex reviewer
Codex implementer → Claude reviewer
Both reviewers
Both planners → cross-review → final plan
Review current git diff only
```

Each option should show a short detail:

```text
Recommended for feature implementation.
Recommended for architecture planning.
Recommended before commit.
```

### 22.3 Progress notification

Use VS Code progress UI:

```text
AI Duo: running Claude implementation... step 1/6
AI Duo: running Codex review... step 3/6
```

Add `Cancel` support.

### 22.4 Timeline Markdown MVP

`summary.md` / `latest.md` format:

```md
# AI Duo Run

## Final Verdict

BLOCK / APPROVE

## Next Actions

1. ...

## Task

...

## Flow

...

## Artifacts

- [Claude implementation](runs/.../01-claude-implementation.md)
- [Codex review](runs/.../03-codex-review.md)

## Full Timeline

...
```

### 22.5 Webview V1.1

Webview sections:

```text
Header: flow, status, duration
Final verdict card
Step timeline
Agent output tabs
Diff viewer links
Action buttons
```

Buttons:

```text
Run Again
Continue with Claude
Continue with Codex
Review Current Diff
Open Run Folder
Open Latest Markdown
```

---

## 23. Security and Privacy

### 23.1 Secrets redaction

Before writing combined prompts to artifacts, redact common secret patterns:

```text
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
AWS_SECRET_ACCESS_KEY=...
GITHUB_TOKEN=...
JWT-like long tokens
.env file snippets
```

Redaction should be conservative but not destructive to code diffs.

### 23.2 Artifact privacy

`.ai-duo/` should be ignored by default:

```gitignore
.ai-duo/
```

Reason:

- AI outputs may include private code paths.
- Diff snapshots may include sensitive code.
- Error logs may include environment data.

### 23.3 Permission guardrails

Reviewer mode:

```text
Claude: --permission-mode plan
Codex: --sandbox read-only --ask-for-approval never
```

Implementer mode:

```text
Claude: --permission-mode acceptEdits
Codex: --sandbox workspace-write --ask-for-approval on-request
```

Forbidden by default:

```text
Claude: --dangerously-skip-permissions / bypassPermissions
Codex: --dangerously-bypass-approvals-and-sandbox / --yolo / danger-full-access
```

### 23.4 Bootstrap trust warning

Before adding `.claude/skills`, show warning:

```text
Project skills can influence Claude Code behavior and may pre-approve tools. Review the generated skill files before trusting the workspace.
```

### 23.5 No backend

MVP must not have a server. All operations run locally via user’s existing CLI tools.

---

## 24. Error Handling

### 24.1 Missing CLI

If `claude` not found:

```text
Claude Code CLI was not found. Set aiDuo.claudePath or install Claude Code.
```

If `codex` not found:

```text
Codex CLI was not found. Set aiDuo.codexPath or install Codex CLI.
```

### 24.2 Auth errors

If Claude auth fails:

```text
Claude Code is not authenticated. Run `claude auth login` in your terminal.
```

If Codex auth fails:

```text
Codex CLI failed authentication. Run Codex CLI directly once and complete login, then retry.
```

### 24.3 Git errors

If not in git repo:

```text
AI Duo works best in a git repository. Continue without diff capture?
```

MVP may require git repo for write/review flows.

### 24.4 Agent timeout

If step times out:

```text
Step timed out after X seconds. Partial output was saved to runs/<id>/<step>.partial.md.
```

### 24.5 Non-zero exit

Save:

```text
<step>.stdout.log
<step>.stderr.log
<step>.exit.json
```

Then show:

```text
Agent step failed. Open stderr log?
```

---

## 25. Data Model and Artifacts

### 25.1 Run directory

Example:

```text
.ai-duo/
  config.json
  latest.md
  runs/
    20260504-153000/
      00-meta.json
      00-task.md
      00-git-status.txt
      01-claude-implementation.md
      01-claude-implementation.stderr.log
      02-diff-after-claude.patch
      03-codex-review.md
      03-codex-review.stderr.log
      04-claude-fix.md
      05-diff-after-fix.patch
      06-codex-final-gate.md
      summary.md
  prompts/
    claude-implementer.md
    claude-reviewer.md
    claude-planner.md
    codex-implementer.md
    codex-reviewer.md
    codex-planner.md
```

### 25.2 Meta JSON

```json
{
  "id": "20260504-153000",
  "version": 1,
  "startedAt": "2026-05-04T15:30:00+03:00",
  "finishedAt": "2026-05-04T15:42:00+03:00",
  "workspaceRoot": "/path/to/project",
  "flowId": "claude-impl",
  "selectedBy": "user",
  "taskHash": "sha256...",
  "status": "succeeded",
  "steps": [
    {
      "id": "claude-implementation",
      "agent": "claude",
      "role": "implementer",
      "status": "succeeded",
      "outputFile": "01-claude-implementation.md",
      "exitCode": 0
    }
  ]
}
```

---

## 26. Auto Router Design

### 26.1 Inputs

```text
Task text
Current git status
Whether git diff exists
Active editor language
Selected text / selected files if available
User default preferences
```

### 26.2 Rule-based MVP

Pseudo-code:

```ts
function route(task: string, git: GitState): RouteDecision {
  const t = task.toLowerCase();

  if (containsAny(t, ["plan", "mimari", "architecture", "tasarım", "strategy", "roadmap", "nasıl olmalı"])) {
    return { flow: "dual-plan", reason: "Task planning/architecture request gibi görünüyor." };
  }

  if (containsAny(t, ["review", "eleştir", "audit", "security", "güvenlik", "risk", "kontrol", "production'a girebilir mi"])) {
    return { flow: "dual-review", reason: "Task review/audit request gibi görünüyor." };
  }

  if (git.hasDiff && task.length < 80) {
    return { flow: "dual-review", reason: "Mevcut diff var ve task kısa; review daha güvenli." };
  }

  if (containsAny(t, ["fix", "düzelt", "implement", "ekle", "bug", "refactor", "build", "yap"])) {
    return { flow: "claude-impl", reason: "Task implementation/fix request gibi görünüyor." };
  }

  return { flow: "claude-impl", reason: "Default implementer Claude olarak ayarlı." };
}
```

### 26.3 V2 router

V2’de router LLM-free kalmalı veya küçük local heuristic ile devam etmeli. Flow seçimi için model çağırmak gereksiz token harcar.

---

## 27. Quality Gates

### 27.1 Final verdict values

```text
approve
approve-with-notes
block
needs-human-decision
```

### 27.2 Block conditions

Reviewer final gate şu durumlarda `block` demeli:

- obvious compile/runtime bug,
- auth/security regression,
- data loss risk,
- migration risk without rollback,
- missing critical test for high-risk flow,
- scope creep,
- destructive operation,
- unverified assumption in critical code path.

### 27.3 Required test commands

Final summary şu formatta test komutları içermeli:

```bash
npm test
npm run lint
flutter test
pnpm test
```

Agent test çalıştırmadıysa:

```text
Tests not run: reason.
Suggested commands: ...
```

---

## 28. MVP Implementation Plan

### Phase 0 — Spike

Goal: Extension’dan Claude ve Codex CLI çağırmanın güvenilirliğini test etmek.

Tasks:

- Minimal VS Code extension oluştur.
- `AI Duo: Run Echo` komutu ekle.
- `claude -p` çağır.
- `codex exec` çağır.
- stdout/stderr artifact’e yaz.
- Cursor’da VSIX olarak kurmayı test et.

Exit criteria:

- Cursor’da command çalışıyor.
- İki CLI’dan output alınabiliyor.

### Phase 1 — Artifact engine

Tasks:

- `.ai-duo/runs/<id>` oluştur.
- `00-task.md`, `00-meta.json`, `summary.md` üret.
- `latest.md` symlink veya copy oluştur.
- Git status/diff capture ekle.

Exit criteria:

- Her run dosya olarak incelenebilir.

### Phase 2 — Flow engine

Tasks:

- `FlowStep` modelini ekle.
- `claude-impl`, `dual-review`, `dual-plan` flow’larını implement et.
- Step progress ve cancellation ekle.
- Timeout ekle.

Exit criteria:

- Üç ana flow Cursor içinden çalışır.

### Phase 3 — Prompt templates

Tasks:

- Built-in prompts yaz.
- Workspace prompt override ekle.
- Reviewer/implementer/planner output formatlarını enforce et.

Exit criteria:

- Outputs tutarlı formatta gelir.

### Phase 4 — Bootstrap

Tasks:

- `.ai-duo/config.json` üret.
- `.claude/skills` üret.
- `AGENTS.md` ve `CLAUDE.md` marker block patchle.
- `.gitignore` patchle.
- Preview UI ekle.

Exit criteria:

- Existing project’e güvenli bootstrap yapılır.

### Phase 5 — UI polish

Tasks:

- Quick Pick flow selector.
- Task input.
- Progress notification.
- Open latest timeline.
- Output channel logs.

Exit criteria:

- MVP daily-use ready.

### Phase 6 — Webview V1.1

Tasks:

- Timeline webview.
- Step cards.
- Verdict badge.
- Artifact links.
- Rerun buttons.

Exit criteria:

- Markdown preview yerine ürün hissi veren panel gelir.

---

## 29. Testing Plan

### 29.1 Unit tests

Test:

- router heuristic,
- config loading,
- prompt interpolation,
- artifact path generation,
- redaction,
- flow step ordering,
- run summary generation.

### 29.2 Integration tests

Mock CLI binaries:

```text
fixtures/bin/claude
fixtures/bin/codex
```

Mock scripts deterministic output üretir.

Test:

- claude-impl flow,
- dual-review flow,
- dual-plan flow,
- CLI non-zero exit,
- timeout,
- cancellation,
- large diff truncation.

### 29.3 Manual tests

En az şu projelerde test:

```text
Small TypeScript repo
Flutter repo
React Native repo
Node backend repo
No git repo
Large diff repo
Dirty working tree repo
```

### 29.4 Security tests

- `.env` içinde dummy secret oluştur, artifact redaction doğrula.
- Reviewer flow’da dosya write denemesi prompt’a rağmen engelleniyor mu kontrol et.
- Bootstrap existing `AGENTS.md` ve `CLAUDE.md` dosyalarını bozuyor mu kontrol et.

---

## 30. Release Criteria

MVP release için:

1. Cursor’da VSIX kurulabiliyor.
2. `AI Duo: Run` çalışıyor.
3. `claude-impl` çalışıyor.
4. `dual-review` çalışıyor.
5. `dual-plan` çalışıyor.
6. `.ai-duo/latest.md` her run sonunda açılıyor.
7. Reviewer mode write yapamıyor.
8. Dangerous modes default kapalı.
9. Bootstrap var ve marker block kullanıyor.
10. README’de kurulum ve kullanım net.

---

## 31. Packaging and Distribution

### 31.1 MVP packaging

MVP bir VS Code-compatible extension olarak paketlenmeli:

```bash
pnpm install
pnpm build
pnpm package
```

Output:

```text
ai-duo-orchestrator-0.1.0.vsix
```

Cursor’a VSIX olarak kurulabilir.

### 31.2 V2 Cursor Plugin path

Cursor plugin ekosistemi; skills, subagents, MCP servers, hooks ve rules gibi agent primitives paketlemeyi desteklediği için V2’de AI Duo’nun prompt/skill/rule katmanı Cursor Plugin olarak da paketlenebilir.

V2 split:

```text
VS Code-compatible extension:
  UI + local CLI orchestration

Cursor Plugin:
  Cursor agent skills/rules/hooks package
```

Bu ayrım mantıklı çünkü Cursor Plugin agent yeteneklerini genişletir; extension ise UI, local process orchestration ve artifact management sağlar.

---

## 32. Risks and Mitigations

### Risk 1 — CLI flag değişiklikleri

Codex veya Claude CLI flag’leri değişebilir.

Mitigation:

- CLI adapter katmanı yaz.
- Version check yap.
- Configurable path ve args override sun.
- Hata mesajında kullanılan komutu göster.

### Risk 2 — Permission boundary tam garanti değildir

AI prompt’ta “write yapma” demek yeterli değil.

Mitigation:

- Reviewer için CLI-level read-only / plan mode kullan.
- Write flow’ları sınırlı tut.
- Dangerous modes blocklist.

### Risk 3 — Large diffs token yakar

Mitigation:

- Diff max byte limit.
- Diff stat + truncated diff.
- Selected files mode.

### Risk 4 — Bootstrap project behavior’ı değiştirir

Mitigation:

- Patch preview.
- Marker block.
- Backup file oluşturma opsiyonu.

### Risk 5 — Dual-agent loops karar kalitesini düşürür

Mitigation:

- Step sayısını sabitle.
- Default max 4–5 step.
- Infinite loop yok.

### Risk 6 — Secret leakage

Mitigation:

- `.ai-duo/` gitignore.
- Redaction.
- `.env` dosyalarını prompt’a dahil etmeme.

### Risk 7 — Cursor/VS Code API uyumluluk farkları

Mitigation:

- Standart VS Code API kullan.
- Proposed API kullanma.
- Cursor’da manuel smoke test.

---

## 33. Open Questions

1. Final judge default Claude mı Codex mi olmalı?
   - Öneri: implementer Claude ise final judge Codex; dual-plan’da final judge Claude.

2. Codex implementer flow MVP’ye dahil edilmeli mi?
   - Öneri: Evet ama Claude implementer flow kadar polish gerektirmez.

3. Bootstrap otomatik mi manuel mi olmalı?
   - Öneri: Manuel command + preview.

4. Webview MVP’ye dahil mi?
   - Öneri: Hayır. Markdown latest yeterli. Webview V1.1.

5. Claude skills gerçek slash invocation ile mi kullanılmalı?
   - Öneri: Interactive kullanım için skills üret; extension non-interactive kullanımda prompt template inject etsin.

6. Parallel dual-review gerekli mi?
   - Öneri: V1.1. MVP’de sequential daha debug edilebilir.

7. Test komutlarını agent mı bulmalı, kullanıcı mı configlemeli?
   - Öneri: Bootstrap sırasında config’e optional test commands eklenebilir.

---

## 34. Success Metrics

MVP için qualitative metrics:

- Kullanıcı manuel copy-paste yapmadan iki model arasında review döngüsü kurabiliyor.
- Bir feature fix akışı 1 komutla tamamlanıyor.
- Final summary hangi risklerin kaldığını net söylüyor.
- Kullanıcı run artifact’lerinden ne olduğunu anlayabiliyor.

Quantitative optional metrics, local only:

```text
runs_total
flows_by_type
average_duration_seconds
failure_rate_by_cli
blocked_verdict_count
```

Telemetry default off olmalı. Local stats config ile açılabilir.

---

## 35. Example End-to-End User Journey

### Scenario

Kullanıcı Cursor’da mobile app auth bug’ı düzeltmek istiyor.

### Steps

1. Command Palette açar.
2. `AI Duo: Run` seçer.
3. Flow olarak `Auto` bırakır.
4. Task yazar:

```text
Refresh token expire olduğunda iki paralel API call aynı anda refresh tetikliyor. Mobile app için race condition'ı düzelt.
```

5. Extension router karar verir:

```text
Selected flow: claude-impl
Reason: implementation/fix request detected.
```

6. Claude implement eder.
7. Codex review eder ve şöyle bir blocker bulur:

```text
Must fix: refresh promise cache reset path'i failed refresh durumunda çalışmıyor; app locked state'e girebilir.
```

8. Claude fix pass yapar.
9. Codex final gate verir:

```text
approve-with-notes
Suggested tests: concurrent refresh, failed refresh, logout during refresh.
```

10. Cursor `.ai-duo/latest.md` dosyasını açar.

---

## 36. README Requirements

Extension README şunları içermeli:

```text
- What it does
- Prerequisites
- Install in Cursor
- Install Claude Code CLI
- Install Codex CLI
- First run
- Bootstrap project rules
- Flow explanations
- Security notes
- Troubleshooting
- FAQ
```

Example usage:

```text
Cmd/Ctrl+Shift+P → AI Duo: Run
Flow: Claude implementer → Codex reviewer
Task: Fix login refresh race condition
```

---

## 37. Implementation Checklist

### Project setup

- [ ] Create extension scaffold.
- [ ] Add TypeScript config.
- [ ] Add command registrations.
- [ ] Add output channel.
- [ ] Add config schema.

### CLI runners

- [ ] Claude runner.
- [ ] Codex runner.
- [ ] Process streaming.
- [ ] Cancellation.
- [ ] Timeout.
- [ ] Exit code handling.

### Artifacts

- [ ] Run directory creation.
- [ ] Meta JSON.
- [ ] Task file.
- [ ] Git status.
- [ ] Diff capture.
- [ ] Latest markdown.
- [ ] Summary markdown.

### Flows

- [ ] Claude implementer flow.
- [ ] Codex implementer flow.
- [ ] Dual review flow.
- [ ] Dual plan flow.
- [ ] Auto router.

### Bootstrap

- [ ] `.ai-duo/config.json`.
- [ ] Prompt templates.
- [ ] Claude skills.
- [ ] `AGENTS.md` marker patch.
- [ ] `CLAUDE.md` marker patch.
- [ ] `.gitignore` patch.
- [ ] Preview UI.

### UI

- [ ] Flow Quick Pick.
- [ ] Task Input Box.
- [ ] Progress notification.
- [ ] Open latest timeline.
- [ ] Cancel command.
- [ ] Optional Webview.

### Testing

- [ ] Unit tests.
- [ ] Mock CLI tests.
- [ ] Manual Cursor VSIX test.
- [ ] Large diff test.
- [ ] Secret redaction test.

---

## 38. Source Notes

These product and technical assumptions are based on official documentation checked on 2026-05-04:

1. Cursor supports plugins and describes plugins as bundles of primitives such as skills, subagents, MCP servers, hooks and rules.  
   Source: https://cursor.com/blog/marketplace

2. Cursor supports installing/managing VS Code extensions.  
   Source: https://cursor.com/help/customization/extensions

3. VS Code extensions can use the VS Code API, Quick Picks for user input, and Webviews for custom UI.  
   Sources:  
   - https://code.visualstudio.com/api/references/vscode-api  
   - https://code.visualstudio.com/api/ux-guidelines/quick-picks  
   - https://code.visualstudio.com/api/extension-guides/webview

4. Claude Code CLI supports `claude -p`, piped input, `--output-format`, `--permission-mode`, `--max-turns`, and related flags.  
   Source: https://code.claude.com/docs/en/cli-reference

5. Claude Code skills use `SKILL.md`, can live in project `.claude/skills/<skill-name>/SKILL.md`, support frontmatter such as `description`, `disable-model-invocation`, `allowed-tools`, `context`, `agent`, and support dynamic context injection with shell commands.  
   Source: https://code.claude.com/docs/en/skills

6. Codex CLI supports non-interactive `codex exec`, `--output-last-message`, structured output, approval and sandbox flags.  
   Sources:  
   - https://developers.openai.com/codex/noninteractive  
   - https://developers.openai.com/codex/cli/reference

7. Codex reads `AGENTS.md` files before doing work and layers global/project guidance.  
   Source: https://developers.openai.com/codex/guides/agents-md

---

## 39. Recommended MVP Cut

The fastest useful MVP is:

```text
Commands:
  AI Duo: Run
  AI Duo: Review Current Diff
  AI Duo: Open Latest Timeline
  AI Duo: Bootstrap Project Rules

Flows:
  claude-impl
  dual-review
  dual-plan
  auto

UI:
  Quick Pick + Input Box + Progress + Markdown latest.md

No Webview yet.
No Cursor Plugin packaging yet.
No cloud backend.
```

This MVP is enough to prove the product. Webview and Cursor Plugin packaging can come after the workflow is actually useful.

---

## 40. Hard Product Opinion

The product should not try to make “two AI chatbots talk forever.” That is a toy.

The valuable product is a strict local orchestration layer:

```text
bounded steps
explicit roles
read/write permissions
git diff grounding
audit artifacts
final verdict
```

That is what turns Claude + Codex from two separate terminals into a real development workflow.

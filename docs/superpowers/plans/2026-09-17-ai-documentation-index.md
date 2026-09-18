# AI Documentation Index Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a fresh AI session reliably orient itself in NaPare before proposing changes, while maintaining more than 200 Markdown documents that map source ownership and verification paths.

**Architecture:** Root instruction files direct agents to one canonical AI index. The index points to stable project maps and generated source cards; each card names one canonical source file, its scope and safe verification command. Generation is deterministic and covered by a validator.

**Tech Stack:** Markdown, Node.js built-ins, repository file paths.

## Global Constraints

- Do not alter application source, navigation, headers, avatars, logos, API contracts, Docker configuration or `apps/web-student/**`.
- Do not document secrets or copy local `.env` values.
- Every source card must reference an existing repository file.
- The validator must require at least 200 Markdown files and validate entry-point links.

---

### Task 1: Create AI entry points and canonical maps

**Files:**
- Create: `AGENTS.md`, `AI_CONTEXT.md`, `docs/ai/README.md`, `docs/ai/project-map.md`, `docs/ai/reading-order.md`, `docs/ai/change-safety.md`

- [ ] Add root instructions that require a fresh agent to read the canonical index before analysis.
- [ ] Describe workspace boundaries, role applications, safe commands and protected design files.
- [ ] Link every top-level document from the AI index.

### Task 2: Build source-card coverage

**Files:**
- Create: `docs/ai/source-cards/*.md`

- [ ] Generate cards from tracked app, package, infrastructure and operational source files.
- [ ] Include canonical source path, scope, reading sequence and a verification command in every card.
- [ ] Generate enough cards that total Markdown count is at least 200.

### Task 3: Validate and hand off

**Files:**
- Create: `scripts/verify-ai-documentation.cjs`
- Create: `docs/ai/maintenance.md`

- [ ] Validate count, entry files, required links and source-card target existence.
- [ ] Run the validator and repository safety guard.
- [ ] Record the archive contents and repeatable maintenance procedure.

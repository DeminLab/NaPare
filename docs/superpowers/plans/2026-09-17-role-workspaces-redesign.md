# Role Workspaces Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a cohesive, hackathon-ready Academic Command Center for staff, admin, and developer workspaces without changing the student app or navigation/avatar/logo work in progress.

**Architecture:** Each role retains its routes and API data flow. A role-scoped token layer and local UI primitives create consistent surfaces; content pages use the same hero, metric rail, action card, table shell, and state patterns. Staff communicates today’s learning flow, admin communicates university health, developer communicates platform reliability.

**Tech Stack:** Next.js 15.5, React 18.3, TypeScript, Tailwind CSS 3, local UI primitives.

## Global Constraints

- Do not modify `apps/web-student/**`.
- Do not modify `apps/*/src/components/navigation/**`, `apps/*/src/components/ui/Avatar.tsx`, headers, or logo assets.
- Do not add dependencies or change API contracts/routes/Docker.
- Preserve loading, error, empty, keyboard and reduced-motion states.
- Verify each role with typecheck, lint, and production build.

---

### Task 1: Establish role-safe visual foundations

**Files:**
- Modify: `apps/web-staff/src/app/globals.css`, `apps/web-admin/src/app/globals.css`, `apps/web-developer/src/app/globals.css`
- Modify: `apps/web-{staff,admin,developer}/src/components/ui/{Card,StatCard,Badge,Button,EmptyState,RequestState,Skeleton}.tsx`
- Create: `docs/design/role-workspace-tokens.md`

**Interfaces:**
- Produces role-scoped classes: `.workspace-hero`, `.workspace-kicker`, `.metric-rail`, `.action-card`, `.table-shell`, `.status-dot`.
- Preserves component public props and all existing imports.

- [ ] Write a static guard test that rejects changes under student, navigation, Avatar and logo paths.
- [ ] Run it and confirm it fails before the guard exists.
- [ ] Define semantic tokens per role: paper/sky for staff, paper/indigo for admin, navy/cyan for developer; document exact hex colors, type scale, spacing, radius, focus and motion values.
- [ ] Update each local primitive to consume tokens and preserve `className`, variant and children behavior.
- [ ] Add responsive table, metric rail and action card utilities; make focus and reduced-motion behavior explicit.
- [ ] Run the static guard and all three typechecks; commit `feat: establish role workspace tokens`.

### Task 2: Redesign the staff learning-operations workspace

**Files:**
- Modify: `apps/web-staff/src/app/(staff)/{today,attendance,groups,week,notifications,profile,settings}/page.tsx`
- Modify: `apps/web-staff/src/app/(staff)/pair-space/page.tsx`, `apps/web-staff/src/app/(staff)/pair-space/[lessonId]/page.tsx`
- Modify: `apps/web-staff/src/app/(auth)/login/page.tsx`

**Interfaces:**
- Consumes Task 1 utilities and existing `apiFetch`, `apiFetchList`, `getUser`, `getNotifications` contracts unchanged.
- Produces a consistent staff page structure: breadcrumb → hero/action → metric rail → primary operational surface → side attention rail.

- [ ] Write a source-level regression test for `today`: existing API endpoint strings and loading/error state components must remain present.
- [ ] Run it and confirm it fails before its test is added.
- [ ] Recompose `today` around a time-led hero, current lesson focus card, timeline and attention rail; retain every existing CTA and response state.
- [ ] Apply the same hierarchy to attendance, groups, week and pair space: actionable metric first, dense data second, empty/error state last.
- [ ] Restyle notifications, profile, settings and auth for calmer paper surfaces and legible mobile forms without editing shared navigation.
- [ ] Run focused test, staff typecheck, lint and `next build`; commit `feat: redesign staff workspace`.

### Task 3: Redesign the admin university-control workspace

**Files:**
- Modify: `apps/web-admin/src/app/(admin)/{dashboard,users,groups,faculties,university,notifications,connectors,schedule-import}/page.tsx`
- Modify: `apps/web-admin/src/app/(auth)/login/page.tsx`

**Interfaces:**
- Consumes Task 1 tokens and existing admin API hooks unchanged.
- Produces a dashboard whose above-the-fold content is university health, risk and the next administrative action.

- [ ] Write a source-level regression test requiring dashboard health calls, connector/sync state and quick-action links to remain intact.
- [ ] Run it and confirm expected failure before the test is added.
- [ ] Recompose dashboard into indigo executive hero, five metric cards, cohort/activity visualization surfaces and an attention queue.
- [ ] Upgrade users/groups/faculties/university pages with table shells, filter/action bars, status chips and mobile overflow behavior.
- [ ] Turn schedule import and connectors into a clearly staged control flow with visible source status, validation, progress, errors and result summaries.
- [ ] Restyle auth/notifications around the same administration language.
- [ ] Run focused test, admin typecheck, lint and `next build`; commit `feat: redesign admin workspace`.

### Task 4: Redesign the developer operational console

**Files:**
- Modify: `apps/web-developer/src/app/(developer)/{overview,api,architecture,docs,session,notifications}/page.tsx`
- Modify: `apps/web-developer/src/app/(auth)/login/page.tsx`

**Interfaces:**
- Consumes Task 1 dark tokens and existing `getHealth`, `getUser`, `apiFetch` contracts unchanged.
- Produces a terminal-inspired console where status, incident risk and action are readable without excessive glow or forced color overrides.

- [ ] Write a source-level regression test requiring health, telemetry, notification and quick-action API/data paths to remain present.
- [ ] Run it and confirm expected failure before the test is added.
- [ ] Recompose overview with status hero, service SLA metric rail, telemetry panels and recent event stream.
- [ ] Apply stable semantic severity surfaces to API, architecture, session, docs and notifications; technical code is monospace, explanatory UI is sans-serif.
- [ ] Make small-screen console panels stack cleanly and keep actionable controls keyboard-visible.
- [ ] Restyle developer auth to match the console without changing navigation/logo/avatar.
- [ ] Run focused test, developer typecheck, lint and `next build`; commit `feat: redesign developer workspace`.

### Task 5: Finish, document, and visually verify the presentation flow

**Files:**
- Modify: `docs/DEVELOPER_GUIDE.md`, `docs/project-log/2026-09-16-max-hackathon-mvp.md`
- Create: `docs/design/role-workspaces-hackathon-demo.md`

**Interfaces:**
- Documents a repeatable demo order: staff today → admin dashboard → developer overview.

- [ ] Run the static guard; verify no prohibited paths changed.
- [ ] Run `pnpm lint`, `pnpm --filter @napare/web-staff exec tsc --noEmit`, `pnpm --filter @napare/web-admin exec tsc --noEmit`, `pnpm --filter @napare/web-developer exec tsc --noEmit`.
- [ ] Run production builds for each role and inspect the three overview pages at desktop and mobile widths.
- [ ] Record the token system, visual QA checklist, demo script, commands and remaining risks in documentation.
- [ ] Commit `docs: record role workspace redesign`.

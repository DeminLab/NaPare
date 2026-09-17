# MAX Hackathon MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn NaPare into a secure, demonstrable MAX education Mini App while repairing the student flows that the demo depends on.

**Architecture:** The Nest backend remains the source of truth. A MAX Mini App is a separate Vite client that calls the existing `/api/v1` API through a small adapter and treats MAX Bridge as optional at development time. Authorization is centralized at controller/service boundaries before student UI actions rely on it.

**Tech Stack:** NestJS, TypeORM, Jest, React, Vite, TypeScript, MAX Bridge, pnpm.

## Global Constraints

- Preserve `/api/v1` and `{ data, meta }` as the public API contract.
- Authorization requires university, group, role, and ownership checks; UUID knowledge must never grant write access.
- MAX identity is server-validated; `initDataUnsafe` is display-only.
- New behavior begins with a failing regression test and ends with a focused test plus the related package build/typecheck.
- Do not migrate Next.js or alter production deployment secrets in this MVP branch.

---

### Task 1: Secure absence mutations and repair absence persistence

**Files:**
- Modify: `apps/backend/src/absences/absences.controller.ts`, `apps/backend/src/absences/absences.service.ts`, `apps/backend/src/absences/dto/create-absence.dto.ts`
- Test: `apps/backend/src/absences/absences.service.spec.ts`

- [ ] Write tests proving a student creates an absence using date-range fields and cannot mutate another student's record.
- [ ] Run the focused Jest suite and confirm the tests fail because the current DTO/service mapping and ownership check are missing.
- [ ] Map the public request shape to required entity fields and require ownership for student mutation; reserve confirmation/excuse for staff roles.
- [ ] Rerun the focused suite and backend build.

### Task 2: Secure schedule and PairSpace write paths

**Files:**
- Modify: `apps/backend/src/schedule/schedule.controller.ts`, `apps/backend/src/pair-space/pair-space.controller.ts`, `apps/backend/src/pair-space/pair-space.service.ts`
- Test: `apps/backend/src/schedule/schedule.controller.spec.ts`, `apps/backend/src/pair-space/pair-space.service.spec.ts`

- [ ] Write failing tests that reject student schedule writes and PairSpace publication outside the caller's allowed group/role.
- [ ] Run focused tests and confirm guards/ownership checks are absent.
- [ ] Add minimal role and group/ownership enforcement without changing read routes.
- [ ] Rerun focused suites and backend build.

### Task 3: Complete student absence and material flows

**Files:**
- Modify: `apps/web-student/src/app/(student)/absences/page.tsx`, `apps/web-student/src/app/(student)/pair-space/[lessonId]/page.tsx`, `apps/web-student/src/lib/api.ts`
- Test: `apps/web-student/src/**/*.test.tsx` or existing configured test location

- [ ] Add failing UI/adapter tests for absence submission and file download links.
- [ ] Add a compact absence CTA/form and link material cards to validated file URLs.
- [ ] Normalize student client parsing to the backend envelope and `/api/v1` paths.
- [ ] Run student typecheck/build and focused UI tests.

### Task 4: Add the MAX Mini App MVP

**Files:**
- Create: `apps/max-miniapp/` including `package.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/lib/max-bridge.ts`, `src/lib/api.ts`, `src/App.tsx`, `src/styles.css`
- Modify: `pnpm-workspace.yaml`, `docker-compose.prod.yml`, `infrastructure/nginx/nginx.conf`
- Test: `apps/max-miniapp/src/lib/max-bridge.test.ts`

- [ ] Write a failing test for browser fallback when MAX Bridge is unavailable.
- [ ] Build a MAX Bridge wrapper that exposes launch data only and does not authenticate from unvalidated client fields.
- [ ] Build the mobile Today, lesson, material, and absence surfaces using the backend adapter.
- [ ] Add a production static build route, then run Mini App tests, typecheck, and production build.

### Task 5: Validate the hackathon demo path

**Files:**
- Modify: `README.md`, `docs/clients/max-miniapp.md`
- Test: existing backend and Docker smoke commands

- [ ] Document local launch, MAX deployment prerequisites, HTTPS requirement, and the demo flow.
- [ ] Run backend tests, all relevant typechecks/builds, Compose config validation, and HTTP smoke checks.

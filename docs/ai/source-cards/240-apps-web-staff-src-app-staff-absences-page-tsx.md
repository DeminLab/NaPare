# Source card: `apps/web-staff/src/app/(staff)/absences/page.tsx`

## Canonical source

`apps/web-staff/src/app/(staff)/absences/page.tsx`

## Scope

Staff absence-review queue for curators, assigned teacher-curators, faculty deans, department heads and university administrators. Existing `/absences?absence=...` notification destinations now resolve within the staff base path. The UI reads the hydrated pending queue with pagination and uses existing curator PATCH confirm/reject endpoints. Rejection requires a reason, failed actions retain the record, and successful decisions remove it before refreshing. A linked record outside the first API page is located by scanning subsequent pages in batches of four. Teachers without an active curator assignment receive an unavailable state; backend guards remain authoritative.

## Read sequence

1. Read [AI context](../../../AI_CONTEXT.md).
2. Read this source and `apps/backend/src/absences/curator.controller.ts`.
3. Read `findPendingForCurrentUniversity` and the confirmation/rejection DTOs.

## Change boundary

Keep backend role and university checks, API contracts and existing notification deep links. Resolve notification targets against the pending queue before reporting that a linked request is unavailable. Do not silently confirm requests or record attendance marks.

## Verification

```powershell
pnpm --filter @napare/web-staff exec tsc --noEmit
pnpm lint
```

Synthetic browser QA confirms a deep link to page 2 of a six-page queue and focuses the reason field with an alert when rejecting without a reason. Browser checks should still cover teacher denial, API failure without losing the record, successful confirm/reject refresh, and a real authorized session.

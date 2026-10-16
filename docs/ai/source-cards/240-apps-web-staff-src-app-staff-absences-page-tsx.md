# Source card: `apps/web-staff/src/app/(staff)/absences/page.tsx`

## Canonical source

`apps/web-staff/src/app/(staff)/absences/page.tsx`

## Scope

Staff absence-review queue for curator, faculty dean, department head and university administrators. Existing `/absences?absence=...` notification destinations now resolve within the staff base path. The UI reads the hydrated pending queue with pagination and uses existing curator PATCH confirm/reject endpoints. Rejection requires a reason, failed actions retain the record, and successful decisions remove it before refreshing. Teachers receive a read-only unavailable state; backend guards remain authoritative.

## Read sequence

1. Read [AI context](../../../AI_CONTEXT.md).
2. Read this source and `apps/backend/src/absences/curator.controller.ts`.
3. Read `findPendingForCurrentUniversity` and the confirmation/rejection DTOs.

## Change boundary

Keep backend role and university checks, API contracts and existing notification deep links. The queue is paginated; a notification target outside the current page is identified by a message rather than reported as resolved. Do not silently confirm requests or record attendance marks.

## Verification

```powershell
pnpm --filter @napare/web-staff exec tsc --noEmit
pnpm lint
```

Browser checks should cover teacher denial, opening a linked record, rejection without a reason, API failure without losing the record, and successful confirm/reject refresh.

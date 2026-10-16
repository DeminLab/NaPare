# Source card: `apps/backend/src/academic/academic.service.ts`

## Canonical source

`apps/backend/src/academic/academic.service.ts`

## Scope

Academic occurrence and course-space operations, including publishing schedule change events with idempotency keys, course names for student context, original schedule values for cancellation notices, and routes to the legacy lesson context or date-based schedule.

Legacy curator read scope uses active curator assignments rather than the singular Group.curatorId pointer. Academic write permissions are not granted by curatorship; preserve the separate primary-role rights of teachers and university operators.

## Read sequence

1. Read [the Schedule module](../../modules/schedule.md) and academic domain docs.
2. Follow occurrence change events through `EventBusService` and `NotificationsService`.

## Change boundary

Keep event payloads tenant-scoped and stable under retries; report cancellation as cancellation and direct students to a valid schedule surface.

## Verification

```powershell
pnpm --filter @napare/backend exec jest --runInBand src/academic/academic.service.spec.ts
pnpm --filter @napare/backend exec tsc --noEmit
```

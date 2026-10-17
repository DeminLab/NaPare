# Source card: SIBIT teacher links migration

## Canonical source

`apps/backend/src/migrations/1700000000023-SibitTeacherLinks.ts`

## Scope

Adds an external teacher source ID to users and imported lessons, with a tenant-scoped unique user key and lesson lookup index.

## Change boundary

The source ID is nullable to preserve existing/manual records. Keep migration up/down changes aligned with the `User` and `Lesson` entities. Do not store an external teacher ID in the student's `groupId` field.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```

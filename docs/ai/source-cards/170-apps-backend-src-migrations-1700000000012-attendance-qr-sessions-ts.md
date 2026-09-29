# Source card: `apps/backend/src/migrations/1700000000012-AttendanceQrSessions.ts`

## Canonical source

`apps/backend/src/migrations/1700000000012-AttendanceQrSessions.ts`

## Scope

Create and remove the tenant-scoped attendance QR session table and its unique token-hash and expiry indexes.

## Read sequence

1. Read [the Absences module](../../modules/absences.md).
2. Compare this migration with `AttendanceQrSession` and the prior attendance records migration.
3. Follow migration registration in the database configuration.

## Change boundary

Keep foreign keys tenant/lesson/creator scoped and never add a plaintext token column.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```

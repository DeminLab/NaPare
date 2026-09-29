# Source card: `apps/backend/src/absences/entities/attendance-qr-session.entity.ts`

## Canonical source

`apps/backend/src/absences/entities/attendance-qr-session.entity.ts`

## Scope

Persisted short-lived attendance QR sessions. Only the SHA-256 token hash is stored.

## Read sequence

1. Read [the Absences module](../../modules/absences.md).
2. Read this entity, `AttendanceQrSessions` migration and `AbsencesService`.
3. Follow attendance constraints to `AttendanceRecord` and lesson/group scope.

## Change boundary

Never persist the raw QR token. Keep token hash unique and retain lesson, tenant, expiry and revocation fields.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```

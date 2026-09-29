# Source card: `apps/backend/src/absences/absences.service.ts`

## Canonical source

`apps/backend/src/absences/absences.service.ts`

## Scope

Tenant-scoped absence and attendance service, including short-lived QR session creation and student check-in.

## Read sequence

1. Start with [AI context](../../../AI_CONTEXT.md) and the relevant role or backend map.
2. Read this canonical source file.
3. Trace direct imports and its nearest caller before widening the investigation.

## Change boundary

Never persist raw QR tokens. Preserve lesson tenant checks, teacher ownership, student group checks, 90-second expiry and one attendance record per lesson/student. A competing insert for the same present record should resolve as `alreadyMarked`, not a duplicate or an error visible to the student.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```


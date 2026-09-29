# Source card: `apps/backend/src/absences/absences.controller.ts`

## Canonical source

`apps/backend/src/absences/absences.controller.ts`

## Scope

Absence endpoints, staff attendance endpoints and role-bound QR session/check-in routes.

## Read sequence

1. Start with [AI context](../../../AI_CONTEXT.md) and the relevant role or backend map.
2. Read this canonical source file.
3. Trace direct imports and its nearest caller before widening the investigation.

## Change boundary

Keep QR creation staff-only, check-in student-only, and follow both routes to the corresponding service scope checks.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```


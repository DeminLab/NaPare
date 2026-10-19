# Source card: `apps/backend/src/admin/admin.service.ts`

## Canonical source

`apps/backend/src/admin/admin.service.ts`

## Scope

NestJS backend module, HTTP boundary, authorization or data-service behavior. Admin audit history joins audit events to users and scopes them by `universityId` before applying pagination; do not build the event set from a capped first page of university users. Faculty dean assignment accepts only an active `faculty_dean` account from the same university; `null` clears the assignment.

## Read sequence

1. Start with [AI context](../../../AI_CONTEXT.md) and the relevant role or backend map.
2. Read this canonical source file.
3. Trace direct imports and its nearest caller before widening the investigation.

## Change boundary

Trace consumers and tests before changing data or authorization behavior.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
pnpm --filter @napare/backend exec jest --runInBand src/admin/admin.service.spec.ts
```

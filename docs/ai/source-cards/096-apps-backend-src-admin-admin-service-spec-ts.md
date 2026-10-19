# Source card: `apps/backend/src/admin/admin.service.spec.ts`

## Canonical source

`apps/backend/src/admin/admin.service.spec.ts`

## Scope

NestJS backend module, HTTP boundary, authorization or data-service behavior.

## Read sequence

1. Start with [AI context](../../../AI_CONTEXT.md) and the relevant role or backend map.
2. Read this canonical source file.
3. Trace direct imports and its nearest caller before widening the investigation.

## Change boundary

Trace consumers and tests before changing data or authorization behavior.

The `getAuditLog` regression test verifies a tenant-scoped audit query, pagination offset/limit, and an event belonging to a user outside the formerly capped account page.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```


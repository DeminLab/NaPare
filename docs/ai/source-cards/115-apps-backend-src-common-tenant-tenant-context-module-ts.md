# Source card: `apps/backend/src/common/tenant/tenant-context.module.ts`

## Canonical source

`apps/backend/src/common/tenant/tenant-context.module.ts`

## Scope

Global request context initialises AsyncLocalStorage before authentication guards. Its mutable store retains the authenticated actor across asynchronous Passport callbacks and isolates concurrent requests. Background jobs keep their existing context behaviour.

## Read sequence

1. Start with [AI context](../../../AI_CONTEXT.md) and the relevant role or backend map.
2. Read this canonical source file.
3. Trace direct imports and its nearest caller before widening the investigation.

## Change boundary

Trace direct imports and the closest route or caller before changing this file.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```


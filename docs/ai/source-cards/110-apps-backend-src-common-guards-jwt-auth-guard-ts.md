# Source card: `apps/backend/src/common/guards/jwt-auth.guard.ts`

## Canonical source

`apps/backend/src/common/guards/jwt-auth.guard.ts`

## Scope

JWT request boundary. University-less developer/superadmin accounts may access platform routes, where PlatformService checks owner/delegated permissions on every request. This exception does not grant access to campus routes.

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


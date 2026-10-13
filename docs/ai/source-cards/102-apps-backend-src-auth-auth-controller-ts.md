# Source card: `apps/backend/src/auth/auth.controller.ts`

## Canonical source

`apps/backend/src/auth/auth.controller.ts`

## Scope

Authentication API routes, including MAX login, JWT-protected MAX link/status, legacy Telegram link/status (410/unavailable). Telegram webhook is unregistered as of 13 October 2026.

## Read sequence

1. Start with [AI context](../../../AI_CONTEXT.md) and the relevant role or backend map.
2. Read this canonical source file.
3. Trace direct imports and its nearest caller before widening the investigation.

## Change boundary

Trace route decorators, guards and the corresponding service before changing an endpoint.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```


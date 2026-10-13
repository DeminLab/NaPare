# Source card: `apps/backend/src/auth/auth.service.ts`

## Canonical source

`apps/backend/src/auth/auth.service.ts`

## Scope

Authentication and account-linking business logic, including MAX `initData` login, authenticated MAX linking, boolean link status, and legacy Telegram linking internals retained for data compatibility. Telegram HTTP linking and webhook delivery are disabled by the 13 October product decision. Portal workspace routing includes employer and career-center primary roles. MAX links are verified against the current JWT user and fresh signed launch data.

## Read sequence

1. Start with [AI context](../../../AI_CONTEXT.md) and the relevant role or backend map.
2. Read this canonical source file.
3. Trace direct imports and its nearest caller before widening the investigation.

## Change boundary

Trace consumers and tests before changing data or authorization behavior.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```


# Source card: Platform discussions DTO

## Canonical source

`apps/backend/src/platform-discussions/platform-discussions.dto.ts`

## Scope

Validates global discussion filters, message corrections, and reversible moderation state changes.

## Change boundary

Keep the state allowlist to `visible`/`hidden`; every edit and moderation action requires a bounded reason.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```

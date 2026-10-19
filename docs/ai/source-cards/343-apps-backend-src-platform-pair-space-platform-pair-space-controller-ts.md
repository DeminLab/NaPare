# Source card: Platform PairSpace announcement controller

## Canonical source

`apps/backend/src/platform-pair-space/platform-pair-space.controller.ts`

## Scope

Exposes authenticated PairSpace and announcement search, detail, and correction routes.

## Change boundary

Pass request IP and user-agent for audit; allow only reasoned announcement content/pinned-state and PairSpace activity correction.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```

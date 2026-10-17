# Source card: Platform career controller

## Canonical source

`apps/backend/src/platform-career/platform-career.controller.ts`

## Scope

Global developer routes for searching, reading, correcting and deciding career profiles and admission requests.

## Change boundary

The service enforces platform permissions, student/university linkage, domain transitions and audit writes. Private detail reads receive request IP and user-agent for audit context.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```

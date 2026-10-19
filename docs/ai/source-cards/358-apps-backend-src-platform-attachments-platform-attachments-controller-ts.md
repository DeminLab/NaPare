# Source card: Platform attachments controller

## Canonical source

`apps/backend/src/platform-attachments/platform-attachments.controller.ts`

## Scope

Exposes paginated search, detail, revoke and restore endpoints for PairSpace attachments.

## Change boundary

Pass IP and user-agent context for audit and keep mutations reasoned and reversible.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```

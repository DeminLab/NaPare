# Source card: Platform attendance QR service

## Canonical source

`apps/backend/src/platform-attendance-qr/platform-attendance-qr.service.ts`

## Scope

Searches QR-session metadata within the delegated university scope and revokes a current session after rechecking the lesson and university relationship.

## Change boundary

Never select, search, return, or audit `tokenHash`. Enforce canonical university scope on list and revoke paths, and record actor, target lesson, university, reason, IP, and user-agent for reads and revocations.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```

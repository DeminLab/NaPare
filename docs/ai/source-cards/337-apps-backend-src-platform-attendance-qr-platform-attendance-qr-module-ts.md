# Source card: Platform attendance QR module

## Canonical source

`apps/backend/src/platform-attendance-qr/platform-attendance-qr.module.ts`

## Scope

Registers global attendance QR-session administration with the session, lesson, group, university, user, and audit repositories.

## Change boundary

Keep all operations behind the dedicated platform permissions.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```

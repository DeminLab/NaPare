# Source card: Platform attendance QR controller

## Canonical source

`apps/backend/src/platform-attendance-qr/platform-attendance-qr.controller.ts`

## Scope

Exposes authenticated QR-session search and one-way revocation routes.

## Change boundary

Pass request IP and user-agent for audit; never accept or return raw QR tokens.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```

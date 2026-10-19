# Source card: Developer attendance QR sessions panel

## Canonical source

`apps/web-developer/src/app/(developer)/control/AttendanceQrSessionsPanel.tsx`

## Scope

Searches platform QR-session metadata by university and status, and allows authorized operators to revoke an active session with a reason and explicit confirmation.

## Change boundary

Never display, request, or store the raw QR token or token hash. Expired sessions cannot be revoked.

## Verification

```powershell
pnpm --filter @napare/web-developer exec tsc --noEmit
```

# Source card: Developer notifications data panel

## Canonical source

`apps/web-developer/src/app/(developer)/control/NotificationsDataPanel.tsx`

## Scope

Developer-control interface for searching and reviewing user notifications and inbox items, correcting permitted fields with a reason, and reviewing/revoking push devices without exposing their tokens.

## Change boundary

Show edit and device-revocation controls only with `notification-data.write`; the backend enforces permissions and records searches, detail views, corrections, and revocations in audit.

## Verification

```powershell
pnpm --filter @napare/web-developer exec tsc --noEmit
```

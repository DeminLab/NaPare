# Source card: Platform attendance QR DTOs

## Canonical source

`apps/backend/src/platform-attendance-qr/platform-attendance-qr.dto.ts`

## Scope

Validates paginated QR-session searches, status and university filters, and revocation reasons.

## Change boundary

Never add a token or token hash field to a platform response DTO.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```

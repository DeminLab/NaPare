# Source card: `apps/backend/src/auth/dto/max-link.dto.ts`

## Canonical source

`apps/backend/src/auth/dto/max-link.dto.ts`

## Scope

Request validation for linking a verified MAX launch to an already authenticated NaPare account. Accepts only MAX `initData`; the current account comes from the bearer JWT.

## Read sequence

1. Read [the MAX client flow](../../clients/max-miniapp.md) and [the auth module](../../modules/auth.md).
2. Follow the DTO to `AuthController.linkMaxToCurrentUser` and `AuthService.linkMaxToAuthenticatedUser`.

## Change boundary

Do not accept a user ID, email or password from this endpoint. The account identity must come from `JwtAuthGuard`, and MAX identity must be verified from initData server-side.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```

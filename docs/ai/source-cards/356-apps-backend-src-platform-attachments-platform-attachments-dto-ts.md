# Source card: Platform attachment DTOs

## Canonical source

`apps/backend/src/platform-attachments/platform-attachments.dto.ts`

## Scope

Validates global attachment search, status, university and reason fields for moderation actions.

## Change boundary

Keep query parameters bounded and require a non-empty reason for reversible hide/restore actions.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```

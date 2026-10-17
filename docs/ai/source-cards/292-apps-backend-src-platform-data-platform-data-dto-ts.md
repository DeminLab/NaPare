# Source card: `apps/backend/src/platform-data/platform-data.dto.ts`

## Canonical source

`apps/backend/src/platform-data/platform-data.dto.ts`

## Scope

Validated filters and mutation payloads for global student-data operations.

## Change boundary

Keep filters bounded, fields allowlisted, and mutation reasons mandatory.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```

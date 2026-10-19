# Source card: Platform academic DTOs

## Canonical source

`apps/backend/src/platform-academic/platform-academic.dto.ts`

## Scope

Validates global lesson-occurrence search filters and reasoned corrections to dates, location, and status.

## Change boundary

Occurrence identity and resource links are not editable through this DTO.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```

# Source card: Platform academic event DTOs

## Canonical source

`apps/backend/src/platform-academic/platform-academic-events.dto.ts`

## Scope

Validates academic event search, supported correction fields, visibility reasons, and pagination.

## Change boundary

Do not add arbitrary payload, actor, relationship, or provenance fields to the write DTO.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```

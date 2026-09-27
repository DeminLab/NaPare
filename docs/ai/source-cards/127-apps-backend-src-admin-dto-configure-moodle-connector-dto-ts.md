# Source card: `apps/backend/src/admin/dto/configure-moodle-connector.dto.ts`

## Canonical source

`apps/backend/src/admin/dto/configure-moodle-connector.dto.ts`

## Scope

Validated input boundary for protected Moodle configuration.

## Change boundary

Accept an HTTPS URL and token only. Never add token fields to public connector response DTOs.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```

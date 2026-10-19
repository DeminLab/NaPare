# Source card: `apps/backend/src/platform-data/platform-data.dto.ts`

## Canonical source

`apps/backend/src/platform-data/platform-data.dto.ts`

## Scope

Validated search filters and correction payloads for absences, attendance, and absence-confirmation decisions, including decision status, comment, and confirmed time.

## Change boundary

Keep filters bounded, correction fields allowlisted, and mutation reasons mandatory. Search audit records query presence rather than the raw free-text value.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```

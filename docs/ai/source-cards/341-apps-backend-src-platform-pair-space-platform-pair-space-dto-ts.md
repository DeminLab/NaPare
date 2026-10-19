# Source card: Platform PairSpace admin DTOs

## Canonical source

`apps/backend/src/platform-pair-space/platform-pair-space.dto.ts`

## Scope

Validates global announcement and space search filters plus reasoned edits to announcement content or PairSpace activity.

## Change boundary

Do not expose author, PairSpace, lesson, or university relationship fields as mutable request properties; a space patch may change only its active state.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```

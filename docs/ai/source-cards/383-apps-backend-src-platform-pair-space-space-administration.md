# Source card: Platform PairSpace administration

## Canonical source

`apps/backend/src/platform-pair-space/platform-pair-space.service.ts`

Related sources: `apps/backend/src/platform-pair-space/platform-pair-space.controller.ts`, `apps/backend/src/platform-pair-space/platform-pair-space.dto.ts`, `apps/backend/src/platform-pair-space/platform-pair-space.module.ts`.

## Scope

Global PairSpace and announcement search, tenant relationship diagnostics, detail-view audit, and reasoned PairSpace lifecycle correction.

## Change boundary

Require `pairspace-content.read/write`; preserve tenant and academic links; allow PairSpace writes only for `isActive`; audit operator, reason, old/new state, university, IP, and user-agent.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```

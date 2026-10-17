# Source card: `apps/backend/src/platform-data/platform-data.service.ts`

## Canonical source

`apps/backend/src/platform-data/platform-data.service.ts`

## Scope

Global student search, absence/attendance edits, university/resource validation, and audit records.

## Change boundary

Keep writes domain-specific and atomic. Preserve ownership and same-university checks, and never expose an unrestricted table editor.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```

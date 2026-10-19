# Source card: `apps/backend/src/platform-data/platform-data.service.ts`

## Canonical source

`apps/backend/src/platform-data/platform-data.service.ts`

## Scope

Global student search, absence/attendance edits, absence-confirmation search/detail/corrections, resource validation, and audit records.

## Change boundary

Keep writes domain-specific and atomic. Validate a decision's absence, student, and university relationship; preserve its `curatorId`. Search audits store whether a free-text query was supplied, never its raw value. Audit views and reasoned corrections with operator, IP, and user-agent.

Every list applies the delegated `universityIds` scope; explicit out-of-scope university filters and direct record reads/writes are rejected through `PlatformService.assertUniversityScope`.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```

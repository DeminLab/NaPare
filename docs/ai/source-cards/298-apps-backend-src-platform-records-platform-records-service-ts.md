# Source card: `apps/backend/src/platform-records/platform-records.service.ts`

## Canonical source

`apps/backend/src/platform-records/platform-records.service.ts`

## Scope

Global user search, personal record reads and writes, relationship checks, and transactional audit. Read and write audit entries include request IP and user-agent; mutations also record the target user, university, reason, and changed values.

## Change boundary

Keep platform read/write permissions distinct, scope every record to its owner and university/resource, and avoid exposing credentials or notification content.

Delegated grants are checked against the current user's university and the stored university of historic records. Lists include only allowed universities, including user records whose owner has since changed universities.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```

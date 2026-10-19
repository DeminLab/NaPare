# Source card: Platform career operations service

## Canonical source

`apps/backend/src/platform-career/platform-career-operations.service.ts`

## Scope

Searches and audits career applications and work results; corrects submissions; selects candidates through existing career invariants; and accepts or returns submitted work. Collection searches validate a requested university against delegated grant scope and constrain unfiltered queries to the allowed universities; detail reads and every mutation check the task's canonical university before returning or changing linked records.

## Change boundary

Mutations lock records and transact domain updates, notifications and audit records. Candidate assignment checks exact student/university eligibility, deadlines, approved profile/admission and the three-active-work limit. Acceptance never records a payment.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```

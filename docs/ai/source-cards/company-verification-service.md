# company-verification-service

## Canonical source

`apps/backend/src/career/company-verification.service.ts`

## Scope

Owner-only recheck, company cooldown, row-lock order, final ownership revalidation and versioned result persistence. Read [registry contract and evidence](../../integrations/company-registry.md) before editing. Do not equate public registry presence with account ownership, trust or partnership verification.

## Verification

Backend/portal typecheck, focused unit tests, disposable company-registry PostgreSQL suite, guard matrix and repository lint/guards. Separate live FNS evidence from mocked transport and browser fixtures; preserve header/navigation/student boundaries.

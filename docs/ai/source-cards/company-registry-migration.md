# company-registry-migration

## Canonical source

`apps/backend/src/migrations/1700000000039-CompanyRegistry.ts`

## Scope

Additive verification fields on existing company records; rollback refuses deleting populated registry data. Read [registry contract and evidence](../../integrations/company-registry.md) before editing. Do not equate public registry presence with account ownership, trust or partnership verification.

## Verification

Backend/portal typecheck, focused unit tests, disposable company-registry PostgreSQL suite, guard matrix and repository lint/guards. Separate live FNS evidence from mocked transport and browser fixtures; preserve header/navigation/student boundaries.

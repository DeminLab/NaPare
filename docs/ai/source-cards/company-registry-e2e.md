# company-registry-e2e

## Canonical source

`apps/backend/test/company-registry.e2e-spec.ts`

## Scope

Real JWT/HTTP/PostgreSQL company registration, persistence, permission/cooldown/race/rollback tests with mocked FNS. Read [registry contract and evidence](../../integrations/company-registry.md) before editing. Do not equate public registry presence with account ownership, trust or partnership verification.

## Verification

Backend/portal typecheck, focused unit tests, disposable company-registry PostgreSQL suite, guard matrix and repository lint/guards. Separate live FNS evidence from mocked transport and browser fixtures; preserve header/navigation/student boundaries.

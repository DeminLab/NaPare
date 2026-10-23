# company-verification-controller

## Canonical source

`apps/backend/src/career/company-verification.controller.ts`

## Scope

JWT recheck endpoint and per-tracker throttle; service decides company-owner authorization. Read [registry contract and evidence](../../integrations/company-registry.md) before editing. Do not equate public registry presence with account ownership, trust or partnership verification.

## Verification

Backend/portal typecheck, focused unit tests, disposable company-registry PostgreSQL suite, guard matrix and repository lint/guards. Separate live FNS evidence from mocked transport and browser fixtures; preserve header/navigation/student boundaries.

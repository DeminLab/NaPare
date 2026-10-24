# Company registry tests

## Canonical source

`apps/backend/src/career/company-registry.service.spec.ts`

## Scope

Synthetic transport tests for the public FNS adapter; no live registry or persistent verification proof. Read [partial integration contract](../../integrations/company-registry.md) and current source observations before editing. Never bypass CAPTCHA, accept fuzzy INN matches or infer employer trust from search presence.

## Verification

Focused Jest suite, backend typecheck and repository lint/guards. Keep mocked protocol proof separate from actual registry, registration, PostgreSQL and browser proof.

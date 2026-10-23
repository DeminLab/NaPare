# Company registry service

## Canonical source

`apps/backend/src/career/company-registry.service.ts`

## Scope

Bounded fixed-host public FNS search, checksum validation, exact registry match and explicit unavailable/challenge states; not wired into company registration yet. Read [partial integration contract](../../integrations/company-registry.md) and current source observations before editing. Never bypass CAPTCHA, accept fuzzy INN matches or infer employer trust from search presence.

## Verification

Focused Jest suite, backend typecheck and repository lint/guards. Keep mocked protocol proof separate from actual registry, registration, PostgreSQL and browser proof.

# Source card: `apps/web-developer/src/app/(developer)/control/CareerCompaniesPanel.tsx`

## Canonical source

`apps/web-developer/src/app/(developer)/control/CareerCompaniesPanel.tsx`

## Scope

Global career company search, safe company text correction, and university partnership review under `career-data.read/write`.

## Change boundary

Company creator identity is immutable. Partnership decisions require a reason, apply only to pending requests, and cannot be made by a member of that company. Detail reads and mutations are audited.

## Verification

Run backend/developer TypeScript checks, root lint, documentation lint, and repository guards. Database and browser checks require a running disposable local environment.

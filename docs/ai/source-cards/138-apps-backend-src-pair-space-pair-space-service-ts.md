# Source card: `apps/backend/src/pair-space/pair-space.service.ts`

## Canonical source

`apps/backend/src/pair-space/pair-space.service.ts`

## Scope

Pair Space access enforces teacher ownership for existing spaces as well as newly created spaces. Student group scopes and private notes remain isolated. Preparation deadlines are normalised from ISO input to Date before saving and publishing events, preventing a post-save 500. Revoked file attachment references are filtered from ordinary PairSpace responses while retaining their existing response shape. The administrator group listing uses a read-only, paginated summary query constrained by the tenant group and its lesson IDs; it never calls the create-on-read lookup.

Role-scope checks reject a missing joined parent with 404 before reading its university. RLS can hide a legacy homework's parent; foreign progress/submit must not throw 500 or write a child row. Real HTTP/PG controls cover creation/update in B and denial with unchanged A/B snapshots.

## Read sequence

1. Read [the Pair Space module](../../modules/pair-space.md).
2. Read the service and its controller/module, including `PersonalLessonNote` upsert, the subject timeline query, and role-scoped access.
3. Follow `PairSpace`, `Homework`, and lesson role-scope checks.

## Change boundary

Keep tenant filters on every query. Preparation items are not submissions; do not use the legacy homework submission model as a student workflow.

## Verification

```powershell
pnpm --filter @napare/backend exec jest src/pair-space/pair-space.service.spec.ts
pnpm --filter @napare/backend exec tsc --noEmit
```

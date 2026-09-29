# Source card: `apps/backend/src/search/search.service.ts`

## Canonical source

`apps/backend/src/search/search.service.ts`

## Scope

Authenticated tenant and role-scoped search across dated lessons, teachers, rooms, Pair Space homework and file names, with a live SIBIT group-schedule fallback for students.

## Read sequence

1. Read [the Search module](../../modules/search.md).
2. Read this service, its DTO, controller and module.
3. Follow lesson and Pair Space ownership to their entities and tenant scope; follow SIBIT fallback to `RaspScraperService` and verify the tenant gate.

## Change boundary

Keep tenant and role filters on every result source. Preserve bounded results and generated internal routes.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```

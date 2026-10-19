# Source card: `apps/backend/src/migrations/1700000000028-PlatformGrantUniversityScope.ts`

## Canonical source

`apps/backend/src/migrations/1700000000028-PlatformGrantUniversityScope.ts`

## Scope

Adds nullable university scope to delegated platform grants. `NULL` preserves existing global grant behavior; an empty UUID array denies university records; populated arrays allow only listed universities.

## Verification

Run backend/developer TypeScript checks, repository documentation guards and lint. Apply migrations only through the documented backup and migration workflow.

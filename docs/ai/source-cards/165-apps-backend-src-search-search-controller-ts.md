# Source card: `apps/backend/src/search/search.controller.ts`

## Canonical source

`apps/backend/src/search/search.controller.ts`

## Scope

JWT-protected `GET /api/v1/search` endpoint and generated Swagger metadata.

## Read sequence

1. Read [the Search module](../../modules/search.md).
2. Read this controller, `SearchQueryDto` and `SearchService`.
3. Follow the global validation and JWT guards.

## Change boundary

Keep the endpoint authenticated and document query validation through DTO decorators.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```

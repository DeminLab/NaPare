# Source card: `apps/backend/src/pair-space/pair-space.controller.ts`

## Canonical source

`apps/backend/src/pair-space/pair-space.controller.ts`

## Scope

Authenticated Pair Space endpoints for lesson content and the role-scoped subject timeline. The timeline contract is `GET /pair-spaces/:lessonId/timeline`.

## Read sequence

1. Read [the Pair Space module](../../modules/pair-space.md).
2. Read this controller and `PairSpaceService`.
3. Follow timeline lesson scope to `Lesson`, `TenantContext`, and `assertLessonScopedAccess`.

## Change boundary

Keep the university ID from JWT context and enforce the student's group / teacher's own lesson scope before returning timeline data. Never include personal lesson notes or legacy submission details.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```

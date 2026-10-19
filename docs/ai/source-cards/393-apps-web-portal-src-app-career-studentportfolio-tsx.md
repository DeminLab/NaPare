# Source card: `apps/web-portal/src/app/career/StudentPortfolio.tsx`

## Canonical source

`apps/web-portal/src/app/career/StudentPortfolio.tsx`

## Scope

Private student career portfolio, accepted-work/review totals, case descriptions, and publish/hide controls. This is inside web-portal and does not replace the student academic workspace.

## Read sequence

Read AI_CONTEXT.md, docs/modules/career.md, this source, `CareerAssistants.tsx`, `api.ts`, and the authenticated portfolio endpoints in `CareerService` before changing behavior.

## Change boundary

Keep the API owner-scoped. Show only own accepted cases with a review; retain employer publication consent as authoritative and never imply that accepted work has been paid. Do not reconstruct task/company/review details by joining capped overview arrays.

## Verification

```powershell
pnpm --filter @napare/web-portal exec tsc --noEmit
pnpm exec eslint apps/web-portal/src/app/career/StudentPortfolio.tsx
```

## Behavior

The component fetches `/career/student/portfolio` pages, renders full-set accepted-work and review aggregates independent of page size, and appends/retries without discarding loaded cases. Case text and publish/hide actions refresh the list. Public links use the student's own ID; items without server-confirmed accepted work and review are not returned.

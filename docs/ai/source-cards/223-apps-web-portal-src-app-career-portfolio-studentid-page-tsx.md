# Source card: `apps/web-portal/src/app/career/portfolio/[studentId]/page.tsx`

## Canonical source

`apps/web-portal/src/app/career/portfolio/[studentId]/page.tsx`

## Scope

Career module: student professional profiles, scoped career-center/company permissions and task lifecycle. Payment provider is intentionally empty; accepted work does not mean paid. Telegram is not used. See [career domain](../../modules/career.md).

## Read sequence

Read AI_CONTEXT.md, docs/modules/career.md, this canonical source and its direct imports before changing behavior.

## Change boundary

Preserve academic tenant isolation. Employer accounts cannot read university records. Only verified students with an exact approved skill may apply to profiled tasks; publication needs both parties' consent. Never expose correct test answers or infer a payment.

## Verification

```powershell
pnpm --filter @napare/web-portal exec tsc --noEmit
```

The anonymous page consumes `/career/accounts/portfolio/:studentId/cases?offset&limit`, appends only consented published cases and shows an accurate total. Each page has sequence protection, loading status, and a retry that keeps already loaded cases. The server returns the same not-found response for missing/inactive students and portfolios with no visible accepted cases; the UI does not expose academic evidence or private review reasons.

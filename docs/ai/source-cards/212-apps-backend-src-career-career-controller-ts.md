# Source card: `apps/backend/src/career/career.controller.ts`

## Canonical source

`apps/backend/src/career/career.controller.ts`

## Scope

Career module: student professional profiles, scoped career-center/company permissions and task lifecycle. Payment provider is intentionally empty; accepted work does not mean paid. Telegram is not used. See [career domain](../../modules/career.md).

## Read sequence

Read AI_CONTEXT.md, docs/modules/career.md, this canonical source and its direct imports before changing behavior.

## Change boundary

Preserve academic tenant isolation. Employer accounts cannot read university records. Only verified students with an exact approved skill may apply to profiled tasks; publication needs both parties' consent. Never expose correct test answers or infer a payment.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
pnpm --filter @napare/backend exec jest --runInBand src/career/career.service.spec.ts
```

`GET /career/tasks` is an additive authenticated task-list endpoint. It accepts optional `workspace`, `q`, `category`, `state`, `offset`, and `limit`; the existing `GET /career` overview payload remains unchanged.

`GET /career/workflows` is an additive authenticated endpoint for paginated application/work records. It accepts `workspace`, `kind`, `q`, `state`, `offset`, and `limit`; selection, submission, decision, and review mutations keep their existing routes and guards.

`GET /career/center/reviews` is an additive center-only endpoint with independent `kind=profiles|admissions`, `q`, `state`, `offset`, and `limit` filters. It preserves the existing profile-verification and admission-decision routes.

`GET /career/partnerships` accepts `workspace=center|employer`, `q`, `state=pending|verified|rejected|all`, `offset`, and `limit`. `GET /career/partnership-eligibility?companyId=...&universityId=...` checks one exact pair for the authenticated active company membership. Existing partnership create and verification routes are unchanged.

`GET /career/tests` accepts optional `offset`, `limit`, and `q` for paginated title/skill search. Requests without these parameters keep the legacy array response. Paginated student items include their own `remainingAttempts` count for the rolling 24-hour window; center responses omit the field. Correct-answer indices are omitted from both response forms; student and center authorization is checked in the service, and employers are denied.

`GET /career/notices` exposes only the authenticated user's paginated `CareerNotice` rows, and `GET /career/notices/unread-count` returns that user's exact unread count. Existing `POST /career/notices/:id/read` remains owner-scoped.

`GET /career/universities?workspace=employer&offset=&limit=&q=` serves paginated selector options to employer accounts; `GET /career/center/assignable-staff?offset=&limit=&q=` serves target accounts only after strict center-admin authorization. Both are additive and leave company, partnership, task, and membership POST routes unchanged.

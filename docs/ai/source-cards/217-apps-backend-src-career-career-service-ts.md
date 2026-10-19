# Source card: `apps/backend/src/career/career.service.ts`

## Canonical source

`apps/backend/src/career/career.service.ts`

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

## Paginated task discovery

The authenticated `GET /career/tasks` list filters tasks inside the actor's student, employer-company, or career-center university scope before applying `q`, `category`, `state`, `offset`, and `limit`. It returns `{items, companies, appliedTaskIds, total, offset, limit, hasMore}` in stable `createdAt DESC, id DESC` order. `limit` is capped at 50. Student task results include that student's already-applied tasks only within their own university; application eligibility and tenant checks remain enforced by `apply()`.

## Paginated workflow history

The authenticated `GET /career/workflows` endpoint accepts `kind=applications|works`, optional `workspace`, `q`, `state`, `offset`, and `limit`, and returns `{items, total, offset, limit, hasMore}` in stable `createdAt DESC, id DESC` order. Students receive only their own records joined to tasks at their university, including older closed-task applications. Employers are restricted to active `company_owner`/`company_member` memberships and their companies' task records. Employer application rows hydrate only the actual applicants' professional profile fields and approved admission bases matching the linked profiled task's exact skill and university. Center workflows are denied; the existing mutation routes remain authoritative for all action guards.

## Paginated career-center review queues

`listCenterReviews()` requires `await center(actor, requireUniversityId(actor))` before reading records. It supports independent `profiles` and `admissions` kinds, kind-specific status filters, server-side search, stable `createdAt DESC, id DESC` sorting, and `{items, total, offset, limit, hasMore}` metadata. Rows are restricted to the actor's university and active student accounts. Admission rows are queried independently and remain visible when no professional profile exists.

## Paginated company partnerships

`listPartnerships()` returns `{items,total,offset,limit,hasMore}` in stable `createdAt DESC, id DESC` order. Center reads require `await center(actor, actor.universityId)` before querying and are limited to that university. Employer reads are restricted to active `company_owner`/`company_member` memberships. `checkPartnershipEligibility()` checks the exact company/university pair after company and university authorization; task creation retains its existing verified-partnership guard.

`tests()` preserves the legacy 100-row array when called without page/search parameters. The additive paginated mode accepts `offset`, `limit` (maximum 50), and `q`, returns `{items,total,offset,limit,hasMore}` in `createdAt DESC, id DESC` order, and searches title/skill inside the authorized tenant. Students are limited to their university; center users pass the strict center role/membership check for their own university before reads; employers are denied. Paginated student items additionally include `remainingAttempts`, aggregated for that student and each listed test over the same rolling 24-hour window enforced by `attempt()`. Center items do not expose student attempt counts. Both response modes strip correct-answer indices from question objects; the attempt endpoint remains authoritative for profile verification, answer validation, and the three-attempt limit.

`listNotices()` is scoped by `userId=actor.id` in the database query, orders by `createdAt DESC, id DESC`, and returns page metadata with a maximum limit of 50. `unreadNoticeCount()` counts only that user's unread `CareerNotice` rows. `readNotice()` still updates only `{id,userId}` and returns not found for a foreign notice.

`listUniversities()` is available only to `UserRole.EMPLOYER` in `workspace=employer`. It returns minimal `{id,name,city}` items for active universities only, searches name/city, orders by `name ASC, id ASC`, and returns exact page metadata with a maximum limit of 50. Existing POST validation is unchanged.

`listAssignableStaff()` awaits `center(actor, actor.universityId, true)` before querying users. The result contains only active users in the actor's university whose roles are not excluded by the existing membership mutation; it returns minimal identity/role fields, searches names, orders by `lastName ASC, firstName ASC, id ASC`, and paginates with a maximum limit of 50. A delegated `career_staff` membership does not satisfy the administrator check, and the existing membership mutation remains authoritative against promotion.

`listStudentAdmissions()` verifies the authenticated student and own university, paginates by `createdAt DESC, id DESC`, and returns own evidence/reason rows plus a separate complete distinct `approvedSkills` list for eligibility checks. `listStudentPortfolio()` joins the actor's own portfolio rows to accepted work, task, and review before `getManyAndCount()`, then hydrates company names. Its full-set aggregate counts accepted works and computes review count/average independent of the current page.

`publicPortfolioCases()` filters before count and page to an active student, published portfolio rows, accepted work owned by that student, task/company, and a review with `publishAllowed=true`. Missing/inactive students and users with no visible cases return the same 404 message. The unauthenticated payload contains published case text, accepted submission/result URL, task/company summary, and consented review only; it does not expose academic evidence or review decision reasons. The legacy `publicPortfolio()` route remains available to old clients.

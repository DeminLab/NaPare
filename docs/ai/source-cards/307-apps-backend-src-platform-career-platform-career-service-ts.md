# Source card: Platform career service

## Canonical source

`apps/backend/src/platform-career/platform-career.service.ts`

## Scope

Searches, reads, corrects and reviews student career profiles/admissions, company/partnership catalog records, career task drafts, access memberships, test definitions and attempts, private content and availability settings across universities. University-bound endpoints enforce delegated platform grant scope on collection queries, detail reads and mutations. A foreign `universityId` filter returns 403; scoped collection queries are constrained to the grant's university IDs, including an empty result for an empty scope.

## Change boundary

Private fields and correct test answers are returned only from audited detail reads. Mutations use transactions and row locks, validate domain links and partnership state, require a reason and write old/new values to the career-scoped audit entity. Company creator identity is immutable and partnership review is blocked for active company owners/members. Global company list/detail/edit and company-membership search/revoke/owner-transfer endpoints reject university-scoped grants; university-center memberships can be listed and revoked only within their explicit allowed university. Company names may appear only as context on an in-scope partnership or task. Task corrections are limited to drafts with no applications or work records and keep company/university links unchanged. Membership revocation is reversible; owner transfer is audited for both affected records; last-owner removal is blocked. Test questions cannot change after attempts exist. Portfolio edits unpublish cases; editing a review withdraws consent and hides its case; notice edits are audited. Availability edits reuse the user-facing validation rules and retain the stored university association.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```

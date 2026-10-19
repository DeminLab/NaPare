# Platform career membership administration

## Canonical source

`apps/backend/src/platform-career/platform-career.service.ts`

Additional sources: `apps/backend/src/migrations/1700000000027-CareerMembershipRevocation.ts`, `apps/backend/src/platform-career/platform-career.controller.ts`, `apps/backend/src/platform-career/platform-career.dto.ts`, `apps/web-developer/src/app/(developer)/control/CareerMembershipsPanel.tsx`.

## Scope

Search career-center and company memberships, then reversibly revoke access with a required reason and audit record. University-center memberships are scoped to their explicit university. Company memberships have no single university association, so company membership search and revocation are owner/global-only. Company ownership can be transferred to an active member; the transfer is recorded against both membership rows and is owner/global-only. The last active owner cannot be revoked without transferring ownership.

## Change boundary

Revoked membership rows remain for history and can be reactivated by the existing authorized assignment flow. Every career authorization and company notification must ignore revoked rows. Platform routes require `career-data.read` or `career-data.write` server-side permission.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
pnpm --filter @napare/web-developer exec tsc --noEmit
```

# Developer career content panel

## Canonical source

`apps/web-developer/src/app/(developer)/control/CareerContentPanel.tsx`

## Scope

Search and administer career portfolio cases, employer reviews, and in-product career notices across users and universities.

## Change boundary

Search/detail routes require `career-data.read`; mutations require `career-data.write` and a reason. Editing case text makes it private. Editing a review withdraws publication consent and hides its related case. Developer tools cannot grant publication consent.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
pnpm --filter @napare/web-developer exec tsc --noEmit
```

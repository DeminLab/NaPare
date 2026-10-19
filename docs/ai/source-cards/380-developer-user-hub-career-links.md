# Developer user hub career links

## Canonical source

`apps/web-developer/src/app/(developer)/control/UserHubPanel.tsx`

## Scope

Expose permission-filtered shortcuts from a selected user to their career profile, operations, memberships, tests, content and availability records.

## Change boundary

Pass only the selected user ID as a search value. Each destination continues to enforce its own server permission and audit behavior.

## Verification

```powershell
pnpm --filter @napare/web-developer exec tsc --noEmit
```

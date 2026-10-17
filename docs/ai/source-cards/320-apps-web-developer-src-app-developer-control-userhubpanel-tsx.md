# Source card: Developer user directory hub

## Canonical source

`apps/web-developer/src/app/(developer)/control/UserHubPanel.tsx`

## Scope

Searchable user directory and summary card that links to the selected user's related developer-control sections.

## Change boundary

Directory data and related-section links follow the permissions provided by the developer control page. The component reuses existing user directory APIs; each destination keeps its own server-side authorization.

## Verification

```powershell
pnpm --filter @napare/web-developer exec tsc --noEmit
```

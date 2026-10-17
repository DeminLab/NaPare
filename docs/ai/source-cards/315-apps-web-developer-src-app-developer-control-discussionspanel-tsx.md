# Source card: Developer discussions panel

## Canonical source

`apps/web-developer/src/app/(developer)/control/DiscussionsPanel.tsx`

## Scope

Search, audited message detail, text correction, and reversible moderation in developer control.

## Change boundary

Read and write controls depend on separate permissions; mutation reasons are required in the panel and validated by the API.

## Verification

```powershell
pnpm --filter @napare/web-developer exec tsc --noEmit
```

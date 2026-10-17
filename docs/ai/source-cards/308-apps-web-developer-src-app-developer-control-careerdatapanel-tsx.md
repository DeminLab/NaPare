# Source card: Developer career data panel

## Canonical source

`apps/web-developer/src/app/(developer)/control/CareerDataPanel.tsx`

## Scope

Global career profile and admission-request search, detail viewing, correction and decisions in developer control.

## Change boundary

Lists show summaries. Opening a record fetches its audited detail; write controls depend on the separate career-data write permission.

## Verification

```powershell
pnpm --filter @napare/web-developer exec tsc --noEmit
```

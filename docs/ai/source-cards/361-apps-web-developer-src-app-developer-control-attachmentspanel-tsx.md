# Source card: Developer attachments panel

## Canonical source

`apps/web-developer/src/app/(developer)/control/AttachmentsPanel.tsx`

## Scope

Provides global search and detail for PairSpace attachment references with reasoned reversible hide/restore actions.

## Change boundary

Show only the sanitized URL path from the API and never imply that moderation deletes a physical file.

## Verification

```powershell
pnpm --filter @napare/web-developer exec tsc --noEmit
```

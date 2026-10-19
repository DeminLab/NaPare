# Source card: `apps/web-developer/src/app/(developer)/notifications/page.tsx`

## Canonical source

`apps/web-developer/src/app/(developer)/notifications/page.tsx`

## Scope

Account notifications grouped by date, paginated through the account API, with a global unread count, explicit unread filtering, safe internal event links and mark-read actions. Only destinations belonging to an existing developer route are rendered. Loading, failed fetch/action and an empty history remain distinct; failed reads are not presented as a successful empty response.

## Read sequence

1. Start with [AI context](../../../AI_CONTEXT.md) and the relevant role or backend map.
2. Read this canonical source file.
3. Trace direct imports and its nearest caller before widening the investigation.

## Change boundary

Trace direct imports and the closest route or caller before changing this file.

## Verification

```powershell
pnpm --filter @napare/web-developer exec tsc --noEmit
```


# Source card: `apps/web-admin/src/app/(admin)/connectors/page.tsx`

## Canonical source

`apps/web-admin/src/app/(admin)/connectors/page.tsx`

## Scope

Administration workspace UI and its data flow.

## Read sequence

1. Start with [AI context](../../../AI_CONTEXT.md) and the relevant role or backend map.
2. Read this canonical source file.
3. Trace direct imports and its nearest caller before widening the investigation.

## Change boundary

Trace direct imports and the closest route or caller before changing this file. Schedule sync returns persisted import counts (`imported`, `updated`, `studentsLinked`) and the UI must show these rather than only fetched source counts. Moodle configuration sends a token once to a protected endpoint and must never render or retain the saved token.

## Verification

```powershell
pnpm --filter @napare/web-admin exec tsc --noEmit
```

# Source card: `apps/backend/src/absences/curator.controller.ts`

## Canonical source

`apps/backend/src/absences/curator.controller.ts`

## Scope

Existing curator absence routes now accept authenticated accounts and enforce assignment/resource checks in CurationService. Decisions flow through AbsencesService into a transaction; primary roles are not replaced and unrelated student access is not globally broadened.

## Read sequence

1. Start with [AI context](../../../AI_CONTEXT.md) and the relevant role or backend map.
2. Read this canonical source file.
3. Trace direct imports and its nearest caller before widening the investigation.

## Change boundary

Trace route decorators, guards and the corresponding service before changing an endpoint.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```


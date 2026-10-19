# Source card: `apps/web-admin/src/app/(admin)/faculties/page.tsx`

## Canonical source

`apps/web-admin/src/app/(admin)/faculties/page.tsx`

## Scope

Administration workspace UI and its data flow.

Faculty search traverses paginated API results. Group and user metric failures remain visible as unavailable data with a retry action; faculty edit/create cannot be dismissed while saving, and save failures are announced inside the modal. The sheet resolves the stored dean ID to an account name, and the form can assign or clear an active faculty-dean account. Teacher-specific faculty totals remain unavailable because the current data model does not link teachers to faculties.

## Read sequence

1. Start with [AI context](../../../AI_CONTEXT.md) and the relevant role or backend map.
2. Read this canonical source file.
3. Trace direct imports and its nearest caller before widening the investigation.

## Change boundary

Trace direct imports and the closest route or caller before changing this file.

## Verification

```powershell
pnpm --filter @napare/web-admin exec tsc --noEmit
```


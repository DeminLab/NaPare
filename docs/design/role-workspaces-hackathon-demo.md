# Role workspaces — demo and verification

## What is already shared

The staff, administration and developer applications use role-scoped workspace tokens and the same content-page entry treatment. The visual layer leaves routes, API contracts, navigation, headers, avatars and logos untouched.

| Workspace | Visual purpose | Accent |
| --- | --- | --- |
| Staff | Focus the working day and teaching actions | Sky |
| Administration | Show university health and control points | Indigo |
| Developer | Surface platform status without excessive terminal styling | Cyan |

## Demo order

1. Open staff **Today**: explain the working-day focus, status cards and readable operational density.
2. Open admin **Dashboard**: show the executive entry surface and compact metrics.
3. Open developer **Overview**: show the dark operational canvas, status hierarchy and preserved monitoring flow.

## Verification

Run from the repository root:

```powershell
node scripts/verify-role-workspace-boundaries.cjs
node scripts/verify-role-workspace-overviews.cjs
pnpm --filter @napare/web-staff exec tsc --noEmit
pnpm --filter @napare/web-admin exec tsc --noEmit
pnpm --filter @napare/web-developer exec tsc --noEmit
```

For a visual pass, start Docker and check the three screens at 1440 px and 390 px wide. The current host has no running Docker engine, so browser-level verification is intentionally pending rather than inferred.

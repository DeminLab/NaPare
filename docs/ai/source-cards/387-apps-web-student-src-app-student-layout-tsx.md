# Source card: `apps/web-student/src/app/(student)/layout.tsx`

## Canonical source

`apps/web-student/src/app/(student)/layout.tsx`

## Scope

Student workspace metadata and providers. The `/student` base path is reflected in the manifest and icon URLs; this segment overrides root icon metadata for authenticated student routes.

## Read sequence

1. Start with [AI context](../../../AI_CONTEXT.md) and the student app map.
2. Read the student root layout and Next.js configuration.
3. Trace the workspace shell and its providers.

## Change boundary

Preserve provider order, the existing `/student` route contract and protected navigation/header/avatar/logo boundaries.

## Verification

```powershell
pnpm --filter @napare/web-student exec tsc --noEmit
```

Browser verification should inspect final icon metadata for `/student/today` and request `/student/icon.svg`.

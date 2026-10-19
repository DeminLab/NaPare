# Source card: `packages/ui/src/WorkspaceShell.tsx`

## Canonical source

`packages/ui/src/WorkspaceShell.tsx`

## Scope

Shared workspace shell, navigation rendering, responsive sidebar/bottom navigation, mobile route title using `mobileLabel` below the desktop breakpoint, and command palette. Desktop headers retain the full route label; mobile navigation keeps the full route name as its accessible name.

## Read sequence

1. Read [AI context](../../AI_CONTEXT.md) and the workspace navigation map.
2. Read this component and the `WorkspaceNavItem` contract.
3. Search every app that supplies `mobileLabel` before changing shared behavior.

## Change boundary

When a mobile label differs from the route's full name, keep the full name available as the link's accessible name. Preserve routes, app base paths and existing keyboard behavior.

## Verification

Run TypeScript and focused ESLint for each app using this shell, then inspect bottom navigation at 320/360/768 px and accessible link names.

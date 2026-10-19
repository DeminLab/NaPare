# Source card: `apps/web-student/src/components/navigation/StudentShell.tsx`

## Canonical source

`apps/web-student/src/components/navigation/StudentShell.tsx`

## Scope

Student workspace navigation, account loading and notification badge. Mobile labels may be shorter than their desktop names; shared navigation exposes the full label as the accessible link name.

## Read sequence

1. Start with [AI context](../../../AI_CONTEXT.md) and the student app map.
2. Read `WorkspaceShell` and its navigation item contract.
3. Trace student route destinations and unread-count source.

## Change boundary

Preserve route destinations, active paths, authentication redirects and full accessible names when changing visible mobile labels.

## Verification

```powershell
pnpm --filter @napare/web-student exec tsc --noEmit
```

Responsive browser checks should include 320, 360 and 768 px and inspect accessible link names.

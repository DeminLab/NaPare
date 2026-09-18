# Change safety

## Protected paths

The active role-workspace work must not modify `apps/web-student/**`, shared navigation, `Avatar.tsx`, headers or logo assets. The static boundary check protects these paths.

## Baseline commands

```powershell
node scripts/verify-role-workspace-boundaries.cjs
node scripts/verify-ai-documentation.cjs
pnpm lint
```

For a role UI change, also run that role's `tsc --noEmit`. Docker/browser checks are only valid when the Docker engine is running; do not infer a visual result when it is unavailable.

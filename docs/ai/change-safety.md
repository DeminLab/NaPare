# Change safety

## Protected paths

The active role-workspace work must not modify `apps/web-student/**`, shared navigation, `Avatar.tsx`, headers or logo assets. The static boundary check protects these paths.

## Baseline commands

On 22 October 2026 the user explicitly approved the student semester screen and a content link in the profile. This permits `apps/web-student/src/app/(student)/semester/page.tsx` and that link in `profile/page.tsx`; it does not extend approval to navigation, headers, Avatar or logos.

```powershell
node scripts/verify-role-workspace-boundaries.cjs
node scripts/verify-ai-documentation.cjs
pnpm lint
```

For a role UI change, also run that role's `tsc --noEmit`. Docker/browser checks are only valid when the Docker engine is running; do not infer a visual result when it is unavailable.

## Approved all-page UX scope — 11 October 2026

The user approved the student workspace and shared navigation work in the product improvement plan, then requested implementation and a Docker review of every page. The guard permits the student experience routes, StudentShell and the exact student API client needed to correctly handle empty personal-note responses. Avatar, logo assets and unrelated protected paths remain blocked; API routes/contracts and Docker/Nginx configuration are preserved.

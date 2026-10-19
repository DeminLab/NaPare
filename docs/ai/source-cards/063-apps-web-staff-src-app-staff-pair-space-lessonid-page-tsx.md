# Source card: `apps/web-staff/src/app/(staff)/pair-space/[lessonId]/page.tsx`

## Canonical source

`apps/web-staff/src/app/(staff)/pair-space/[lessonId]/page.tsx`

## Scope

Staff lesson workspace with date/group context, attendance link, preparation preview and pinned announcements first. Shared tabs use manual keyboard activation and are connected to a named `tabpanel`; the selected tab and focused tab can differ while arrow keys move focus. Discussion is multiline and explicit; mutation errors remain visible in their forms, and concurrent submits are blocked. Load and action sequence guards discard results from a previous lesson when navigation changes `lessonId` before those requests finish. Announcement and homework forms explain empty submissions; material type follows the supported backend enum, and links must be valid HTTPS URLs.

## Read sequence

1. Start with [AI context](../../../AI_CONTEXT.md) and the relevant role or backend map.
2. Read this canonical source file.
3. Trace direct imports and its nearest caller before widening the investigation.

## Change boundary

Trace direct imports and the closest route or caller before changing this file.

## Verification

```powershell
pnpm --filter @napare/web-staff exec tsc --noEmit
```

The shared tab keyboard path and responsive widths were also checked in a synthetic Playwright route; authorized route activation and screen-reader behavior remain unverified.


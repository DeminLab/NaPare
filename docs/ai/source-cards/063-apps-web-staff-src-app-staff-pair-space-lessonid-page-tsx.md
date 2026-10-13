# Source card: `apps/web-staff/src/app/(staff)/pair-space/[lessonId]/page.tsx`

## Canonical source

`apps/web-staff/src/app/(staff)/pair-space/[lessonId]/page.tsx`

## Scope

Staff lesson workspace with date/group context, attendance link, preparation preview and pinned announcements first. Discussion is multiline and explicit; mutation errors remain visible in their forms, and concurrent submits are blocked.

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


# Source card: `apps/web-staff/src/app/(staff)/pair-space/[lessonId]/page.tsx`

## Canonical source

`apps/web-staff/src/app/(staff)/pair-space/[lessonId]/page.tsx`

## Scope

Teacher lesson workspace has four focused tabs and one publication toolbar. Main tab displays actual announcements and preparation links. Adding material publishes a link to a file, rather than claiming file upload. Subject types are translated for users.

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


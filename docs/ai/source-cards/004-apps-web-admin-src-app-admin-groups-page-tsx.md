# Source card: `apps/web-admin/src/app/(admin)/groups/page.tsx`

## Canonical source

`apps/web-admin/src/app/(admin)/groups/page.tsx`

## Scope

Administration workspace UI and its data flow. Group schedule details show the shared lesson-type badge when source type data is available.
Group detail student requests use a latest-request guard so late responses from a previously selected group cannot replace the current roster. Detail section controls expose their selected state with `aria-pressed`.
The group attendance section is read-only: it selects one current-year lesson, loads all paginated attendance records, and presents saved status totals with distinct loading, error/retry, empty schedule, and empty attendance states. Schedule rows prefer `groupId` matching to avoid mixing same-named groups; the existing name fallback supports older schedule payloads.
The create/edit modal blocks Escape, overlay and cancel close actions while a save is in flight to prevent duplicate submissions.

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


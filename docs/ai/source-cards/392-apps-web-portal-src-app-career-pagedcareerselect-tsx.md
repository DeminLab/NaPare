# Source card: `apps/web-portal/src/app/career/PagedCareerSelect.tsx`

## Canonical source

`apps/web-portal/src/app/career/PagedCareerSelect.tsx`

## Scope

Reusable paginated lookup selector for career workflow forms. It is used for active university choices and assignable center staff.

## Read sequence

Read the career page, the service/controller cards for selector endpoints, and `TaskComposer.tsx` for the controlled usage.

## Change boundary

Keep the selected ID in the native named `<select>` so FormData submissions remain compatible. Query changes invalidate in-flight requests, fresh searches replace results, and append failures retain existing options. Backend authorization and membership mutation guards remain authoritative.

## Verification

```powershell
pnpm --filter @napare/web-portal exec tsc --noEmit
pnpm --filter @napare/web-portal exec eslint src/app/career/PagedCareerSelect.tsx src/app/career/TaskComposer.tsx src/app/career/page.tsx
```

The selector debounces search by 250 ms, reports total/loaded counts, offers retry and append controls, and retains a selected option when it is not present in the latest search page.

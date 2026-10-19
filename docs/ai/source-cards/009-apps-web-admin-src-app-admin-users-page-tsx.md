# Source card: `apps/web-admin/src/app/(admin)/users/page.tsx`

## Canonical source

`apps/web-admin/src/app/(admin)/users/page.tsx`

## Scope

Role counters are compact filters. The blocked counter activates `status=blocked`, while other counters reset status to all. Desktop row role selectors have per-user accessible names.

User directory with mobile cards, URL filters, bulk confirmation and partial results. Details use the shared Sheet. Individual role changes require confirmation and update both directory/detail state only after success; API failures preserve the previous role. A role update invalidates the user's active sessions, so both individual and bulk confirmations explain that the user will need to sign in again. Bulk success feedback is shown only when at least one update succeeds; failed users remain selected.

## Read sequence

1. Start with [AI context](../../../AI_CONTEXT.md) and the relevant role or backend map.
2. Read this canonical source file.
3. Trace direct imports and its nearest caller before widening the investigation.

## Change boundary

Trace direct imports and the closest route or caller before changing this file.

Sheet приостановлен во время подтверждения роли или сброса пароля: одновременно активен один диалог; отмена возвращает исходную роль.

## Verification

```powershell
pnpm --filter @napare/web-admin exec tsc --noEmit
```


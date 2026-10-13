# Source card: `apps/web-admin/src/app/(admin)/users/page.tsx`

## Canonical source

`apps/web-admin/src/app/(admin)/users/page.tsx`

## Scope

User directory with mobile cards, URL filters, bulk confirmation and partial results. Details use the shared Sheet. Individual role changes require confirmation and update both directory/detail state only after success; API failures preserve the previous role.

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


# Source card: `apps/web-admin/src/app/(admin)/university/page.tsx`

## Canonical source

`apps/web-admin/src/app/(admin)/university/page.tsx`

## Scope

University profile, structure and source type selection using the existing PATCH contract. Unknown current source types are preserved until a supported type is explicitly selected.

The content links to `/onboarding`, including when the current university is unavailable to the platform owner. The wizard does not alter shared navigation or headers; see [onboarding](../../modules/university-onboarding.md).

## Read sequence

1. Start with [AI context](../../../AI_CONTEXT.md) and the relevant role or backend map.
2. Read this canonical source file.
3. Trace direct imports and its nearest caller before widening the investigation.

## Change boundary

Trace direct imports and the closest route or caller before changing this file.

Сбой вспомогательного запроса отличается от пустого списка и нулевой статистики; структура содержит явное состояние ошибки.

## Verification

The academic-office content link opens `/requests`; shared navigation/header assets remain unchanged. Verify the office page and admin typecheck separately.

```powershell
pnpm --filter @napare/web-admin exec tsc --noEmit
```

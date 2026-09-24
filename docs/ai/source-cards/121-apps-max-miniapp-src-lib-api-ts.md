# Source card: `apps/max-miniapp/src/lib/api.ts`

## Canonical source

`apps/max-miniapp/src/lib/api.ts`

## Scope

API client of the MAX Mini App: token storage (localStorage with in-memory fallback), automatic refresh after 401, `ApiError` mapping of backend `{statusCode, code, message}` bodies, and typed calls — `/auth/max`, `/auth/login`, `/my-day`, `/schedule/my`, `/notifications`, `/users/me`, `/pair-spaces/:lessonId`, `/absences`.

## Read sequence

1. Start with [AI context](../../../AI_CONTEXT.md) and the [max-miniapp client doc](../../clients/max-miniapp.md).
2. Read this canonical source file.
3. Follow its consumer `apps/max-miniapp/src/App.tsx` (auth gate and screens).

## Change boundary

Launch data (`initData`) must only be sent to `/auth/max` — never treated as identity locally. Keep `/api/v1` as the base path (dev proxy in `vite.config.ts`, nginx `location /api/` in the container). Do not store anything but tokens in `localStorage`.

## Verification

```powershell
pnpm --filter @napare/max-miniapp test
pnpm --filter @napare/max-miniapp build
```

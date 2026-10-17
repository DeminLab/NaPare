# Source card: Platform discussions controller

## Canonical source

`apps/backend/src/platform-discussions/platform-discussions.controller.ts`

## Scope

Global developer routes for searching, reading, editing and moderating Pair Space discussion messages.

## Change boundary

Pass request IP and user-agent to the service. Platform permissions and Pair Space/university/lesson integrity checks remain server-side.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```

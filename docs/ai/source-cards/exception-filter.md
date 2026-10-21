# Source card: API exception filter and sanitized Sentry reporting

## Canonical source

`apps/backend/src/common/filters/http-exception.filter.ts`

## Scope

Existing machine-readable API error response plus sanitized Sentry messages for 5xx when the client is configured. No exception text, raw URL, body, query or user fields are supplied to Sentry by this hook.

## Verification

```powershell
pnpm --filter @napare/backend exec jest src/common/filters/http-exception.filter.spec.ts --runInBand
```

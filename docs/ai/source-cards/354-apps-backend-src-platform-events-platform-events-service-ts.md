# Source card: Platform events service

## Canonical source

`apps/backend/src/platform-events/platform-events.service.ts`

## Scope

Searches immutable events, returns an allowlisted and sanitized payload, and audits searches and detail views. Delegated grants are restricted to their university scope in both search and detail; owner and global grants retain all-university access.

## Change boundary

Never return raw payload, recipients or idempotency keys. Do not persist raw search text in audit records. Require a matching University for listed and detailed events; reject explicit out-of-scope university filters before querying.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```

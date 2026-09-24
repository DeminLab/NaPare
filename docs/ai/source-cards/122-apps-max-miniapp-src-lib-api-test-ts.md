# Source card: `apps/max-miniapp/src/lib/api.test.ts`

## Canonical source

`apps/max-miniapp/src/lib/api.test.ts`

## Scope

Vitest coverage of the mini app API client: token storage round-trip, `Authorization` header, single refresh retry after 401, token drop on rejected refresh, surfacing of backend codes (`MAX_ACCOUNT_NOT_LINKED`), MAX login token persistence, and network-error mapping to `NETWORK_ERROR`.

## Read sequence

1. Start with [AI context](../../../AI_CONTEXT.md).
2. Read this spec together with `apps/max-miniapp/src/lib/api.ts`.
3. Fetches are mocked with `vi.stubGlobal('fetch', …)` — no real backend is required.

## Change boundary

Keep tests offline (mocked `fetch`, in-memory storage fallback). If the refresh policy or error codes change, update this spec, `api.ts`, and the contract in `docs/api/contracts.md` together.

## Verification

```powershell
pnpm --filter @napare/max-miniapp test
```

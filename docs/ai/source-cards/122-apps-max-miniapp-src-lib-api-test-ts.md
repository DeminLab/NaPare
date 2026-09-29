# Source card: `apps/max-miniapp/src/lib/api.test.ts`

## Canonical source

`apps/max-miniapp/src/lib/api.test.ts`

## Status

Historical source card. The standalone client is not deployed; MAX opens `web-portal`. See [current MAX client flow](../../clients/max-miniapp.md).

## Scope

Historical Vitest coverage of the retired mini app API client: token storage, refresh retry, backend error mapping, and network-error handling.

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

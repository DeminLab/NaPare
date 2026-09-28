# Source card: `apps/max-miniapp/vite.config.ts`

## Canonical source

`apps/max-miniapp/vite.config.ts`

## Scope

Vite build and development-server settings for the MAX Mini App. Production assets use the `/max/` public base path while API calls stay on the shared-origin `/api/v1` route.

## Related source

- `infrastructure/nginx/nginx.conf` strips `/max/` when proxying requests to the Mini App container.
- `apps/max-miniapp/nginx.conf` serves built assets from the container root and proxies `/api/` to the backend.
- `docs/clients/max-miniapp.md` documents the production URL and deployment check.

## Change boundary

Keep the production base path aligned with Docker Nginx and retain the local `/api` development proxy.

## Verification

```powershell
pnpm --filter @napare/max-miniapp build
```

The output should reference assets under `/max/assets/`.

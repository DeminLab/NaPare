# Source card: `apps/max-miniapp/vite.config.ts`

## Canonical source

`apps/max-miniapp/vite.config.ts`

## Scope

Legacy Vite build and development-server settings for the retired standalone MAX client. The production `/max/` route now proxies to `web-portal`; this package is retained as source only, excluded from the standard root `pnpm dev` and `pnpm build` tasks, and is not part of `docker-compose.prod.yml`.

## Related source

- `infrastructure/nginx/nginx.conf` rewrites `/max/` to the shared `web-portal`.
- `docs/clients/max-miniapp.md` documents the shared site and MAX auth flow.

## Change boundary

This configuration is legacy. Do not route the bot back to this client; MAX users now share the main website.

## Verification

```powershell
pnpm --filter @napare/max-miniapp build
```

This check is only relevant if the legacy client is intentionally revived.

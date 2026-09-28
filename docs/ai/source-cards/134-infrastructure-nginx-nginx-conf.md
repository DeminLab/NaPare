# Source card: `infrastructure/nginx/nginx.conf`

## Canonical source

`infrastructure/nginx/nginx.conf`

## Scope

Docker Nginx routing between the public portal, backend API, and role workspaces on the shared NaPare origin.

## Related source

- `docker-compose.prod.yml` defines the frontend upstream services.
- `apps/web-developer/next.config.js` configures the `/developer` Next.js base path.
- `apps/max-miniapp/vite.config.ts` configures the `/max/` asset base for the MAX Mini App.
- `DEPLOY.md` documents the public route map.

## Change boundary

Do not expose internal web ports publicly. Preserve the `/developer` path when proxying to Next.js so assets, pages, and same-origin API requests resolve correctly. For `/max/`, strip that prefix when proxying to the Mini App container because its Nginx serves the built files from `/`.

## Verification

```powershell
docker compose -f docker-compose.prod.yml config
```

Validate the Nginx syntax and request the developer login through the shared-origin gateway when Docker is available.

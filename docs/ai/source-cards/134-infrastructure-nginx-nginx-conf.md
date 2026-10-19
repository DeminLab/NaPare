# Source card: `infrastructure/nginx/nginx.conf`

## Canonical source

`infrastructure/nginx/nginx.conf`

## Scope

Docker Nginx routing between the public portal, backend API, and role workspaces on the shared NaPare origin.

## Related source

- `docker-compose.prod.yml` defines the frontend upstream services.
- `apps/web-developer/next.config.js` configures the `/developer` Next.js base path.
- `docs/clients/max-miniapp.md` documents that `/max/` now proxies to the public portal for shared MAX/site authentication.
- `docs/deployment/production.md` documents the public route map.

## Change boundary

Do not expose internal web ports publicly. Resolve Docker service names dynamically so Nginx follows container IP changes after a service recreation. Preserve the `/developer` path when proxying to Next.js so assets, pages, and same-origin API requests resolve correctly. `/max/` rewrites to the public portal root so MAX and browser users enter the same website.

## Verification

```powershell
docker compose -f docker-compose.prod.yml config
```

Validate the Nginx syntax and request the developer login through the shared-origin gateway when Docker is available.

# Source card: `apps/web-developer/next.config.js`

## Canonical source

`apps/web-developer/next.config.js`

## Scope

Next.js deployment settings for the developer workspace, including the shared-origin `/developer` base path and backend rewrites.

## Related source

- `infrastructure/nginx/nginx.conf` routes `/developer/` to the developer app while preserving the path prefix.
- `apps/web-portal/src/app/login/page.tsx` sends developer users to `/developer/api` after shared authentication.
- `apps/backend/src/auth/auth.service.ts` maps the developer role to the developer workspace.

## Change boundary

Keep same-origin API requests at `/api/v1` and verify Next static assets, login routes, and authenticated workspace routes under `/developer/`.

## Verification

```powershell
pnpm --filter @napare/web-developer exec tsc --noEmit
```

Build the app and request `/developer/login` through Docker Nginx when available.

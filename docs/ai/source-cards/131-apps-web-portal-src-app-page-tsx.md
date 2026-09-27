# Source card: `apps/web-portal/src/app/page.tsx`

## Canonical source

`apps/web-portal/src/app/page.tsx`

## Scope

Public NaPare landing page. The hero uses a single full-bleed campus image behind the copy; lower informational sections stay text and interface-led. The NP mark is the only separate brand image.

## Related source

- `apps/web-portal/src/app/portal.css` controls responsive hero placement, overlays, and typography.
- `apps/web-portal/src/app/layout.tsx` provides the site metadata and favicon paths.
- `infrastructure/docker/web.Dockerfile` must include public assets in the production runtime.

## Change boundary

Keep the hero image decorative and preserve readable contrast over it. Avoid adding image galleries or extra photo sections without a new design direction.

## Verification

```powershell
pnpm --filter @napare/web-portal exec tsc --noEmit
```

When reviewing the landing page, confirm the hero image and logo load, the hero copy fits on desktop and mobile, and the production image includes `apps/web-portal/public/`.

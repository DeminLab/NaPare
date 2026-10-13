# Source card: `apps/web-portal/src/app/page.tsx`

## Canonical source

`apps/web-portal/src/app/page.tsx`

## Scope

Public NaPare landing page. The hero uses one full-bleed campus image with readable copy over a dark overlay; a responsive cabinet mockup appears in the next product-focused section. Lower informational sections remain text and interface-led, without an image gallery.

## Related source

- `apps/web-portal/src/app/portal.css` controls responsive hero placement, overlays, and typography.
- `apps/web-portal/src/components/ProductShowcase.tsx` renders the sample schedule, preparation notice, notification, teacher, attendance statistic, and personal-cabinet UI below the hero.
- `apps/web-portal/src/app/layout.tsx` provides the site metadata and favicon paths.
- `apps/web-portal/src/components/MaxLaunchAuth.tsx` captures MAX launch data in memory on the landing page; authentication and linking start only on `/login` after the visitor chooses «Войти».
- `/connections` is the account's MAX account connection flow; it does not handle login credentials.
- `infrastructure/docker/web.Dockerfile` must include public assets in the production runtime.

## Change boundary

Keep the campus photo confined to the hero and the mockup data clearly demonstrative, accessible, and readable at narrow widths. Do not imply that assignment submission or grading replaces Moodle. Opening the landing page from MAX must not automatically authenticate or show account linking; retain launch data only in memory until the visitor chooses «Войти». The login flow must use backend-validated `initData`.

## Verification

```powershell
pnpm --filter @napare/web-portal exec tsc --noEmit
```

When reviewing the landing page, confirm the hero image and logo load, the hero copy and mockup fit on desktop and mobile, and the production image includes `apps/web-portal/public/`.

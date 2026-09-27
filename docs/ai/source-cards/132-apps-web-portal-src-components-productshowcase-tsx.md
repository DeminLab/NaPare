# Source card: `apps/web-portal/src/components/ProductShowcase.tsx`

## Canonical source

`apps/web-portal/src/components/ProductShowcase.tsx`

## Scope

Static, accessible product preview shown in a dedicated section immediately after the public landing hero. It illustrates the student personal cabinet, schedule, teacher announcement/preparation context, notification, teacher profile, and sample attendance statistic.

## Related source

- `apps/web-portal/src/app/page.tsx` places the preview in the product-overview section below the hero.
- `apps/web-portal/src/app/portal.css` defines its responsive visual treatment.

## Change boundary

Keep this component presentational. Label values as demonstration data and do not imply Moodle assignment submission or grading is handled here.

## Verification

```powershell
pnpm --filter @napare/web-portal exec tsc --noEmit
```

Check that all preview content remains readable and contained on desktop, tablet, and narrow mobile widths.

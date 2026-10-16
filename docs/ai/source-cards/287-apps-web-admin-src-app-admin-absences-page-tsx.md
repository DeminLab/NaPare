# Source card: `apps/web-admin/src/app/(admin)/absences/page.tsx`

## Canonical source

`apps/web-admin/src/app/(admin)/absences/page.tsx`

## Scope

University absence-review queue. Pending records, confirmation, rejection with a required reason, notification selection and refresh use existing university APIs. Zero pending records do not display an attention badge or duplicate page introduction.

## Read sequence

Read AI_CONTEXT.md, the page, admin API client and backend absence controllers before changing decisions or authorization.

## Verification

Run admin TypeScript and lint; check loaded, empty, failed and selected-record views in the browser. Test review decisions against authorized test data only.

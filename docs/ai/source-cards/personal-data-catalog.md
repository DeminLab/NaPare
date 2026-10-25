# Personal export projections

## Canonical source

`apps/backend/src/users/personal-data.catalog.ts`

## Scope

Reviewed subject/activity projections, explicit non-export classifications and download limitations. No dynamic client table/column names or automatic export of new fields. Read [export behavior](../../privacy/personal-data-export.md).

Device export includes own WebPush consent timestamp, version and revocation timestamp. Raw endpoint/token/subscription keys remain excluded.

## Verification

Personal-data PostgreSQL tests validate actual metadata columns and require every entity table to be exported or explicitly classified. Review each new sensitive field before adding it.

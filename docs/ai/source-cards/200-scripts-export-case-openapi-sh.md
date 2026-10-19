# Source card: `scripts/export-case-openapi.sh`

## Canonical source

`scripts/export-case-openapi.sh`

## Scope

Fetches the live NestJS-generated OpenAPI JSON from a deployed HTTPS API into `deliverables/educational-solutions/openapi.json`. It requires no API credentials because the Swagger JSON route is public, checks for the case-required `/api/v1/auth/max` and `/api/v1/absences/attendance/qr-check-in` paths, and leaves the API source of truth in NestJS decorators. The `/api/v1` prefix is included because Swagger generation respects the backend global prefix.

## Read sequence

1. Read [the API guide](../../api/README.md) and [the case submission README](../../deliverables/educational-solutions/README.md).
2. Check that `PUBLIC_APP_URL` is the intended API host and that its `/api/v1/docs-json` endpoint is deployed.

## Change boundary

Do not hand-edit the generated `openapi.json`. Do not include secrets, access tokens, or passwords in the exported spec.

## Usage

```bash
PUBLIC_APP_URL=https://napare.sano.ru bash scripts/export-case-openapi.sh
```

## Verification

Run the script against the deployed API and confirm that the resulting
`deliverables/educational-solutions/openapi.json` contains the required paths.
The generated OpenAPI file is a deliverable only when it is intentionally
refreshed for a submission; do not commit a stale export.

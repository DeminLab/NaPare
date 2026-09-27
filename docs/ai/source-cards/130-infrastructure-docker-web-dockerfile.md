# Source card: `infrastructure/docker/web.Dockerfile`

## Canonical source

`infrastructure/docker/web.Dockerfile`

## Purpose

Builds the standalone Next.js runtime images used by the portal and role-based web applications.

## Runtime asset handling

Copies `.next/standalone`, `.next/static`, and the app's `public/` assets into the runner. The public directory is optional because several workspace apps do not define one; the build stage stages an empty directory when needed so the generic runner copy remains valid.

## Related configuration

- `docker-compose.prod.yml` supplies `APP_DIR` and `PACKAGE_NAME` for each web service.
- `docs/ops/deployment.md` describes the production image and asset behavior.

## Verification

After changing this file, build the portal image and confirm a known `/brand/*` asset returns HTTP 200 from the running container. Also build a web app without a `public/` directory to validate the optional path.

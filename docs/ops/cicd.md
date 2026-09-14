# CI/CD

## Workflows

`CI` runs for every pull request to `main` and every push to `main`. Its independent required checks are:

- lint;
- TypeScript typecheck;
- backend unit tests and coverage;
- backend E2E tests against ephemeral PostgreSQL and Redis;
- production application build;
- production dependency audit.

Test output, coverage, and audit JSON are uploaded as GitHub Actions artifacts even when a job fails. pnpm's store and Turbo outputs are cached per lockfile.

After a successful push to `main`, `Build images and deploy staging` builds immutable GHCR images tagged with the commit SHA, deploys them to the protected `staging` environment, then checks `/api/v1/health`.

## Required staging secrets

Configure these as **GitHub Environment secrets** for `staging`, never as committed `.env` files:

- `STAGING_HOST`
- `STAGING_USER`
- `STAGING_SSH_KEY`
- `STAGING_KNOWN_HOSTS`
- `STAGING_DEPLOY_COMMAND`
- `STAGING_URL`

`STAGING_DEPLOY_COMMAND` runs on the staging host with `NAPARE_IMAGE_PREFIX` and `NAPARE_IMAGE_TAG` set to the immutable images built by CI. It must pull those exact image tags and perform the host-specific rollout. The workflow fails clearly if any required secret is missing.

## Production safety

There is deliberately no production deployment workflow. Production promotion must be a separate manually-dispatched workflow protected by a GitHub Environment with required reviewers, a verified staging release, and an approved rollback plan.

## Branch protection recommendations

Protect `main` with the following GitHub rules:

1. Require pull requests before merging and at least one approving review.
2. Require the `Lint`, `Typecheck`, `Unit tests and coverage`, `Backend E2E`, `Production application build`, and `Dependency security audit` checks.
3. Require branches to be up to date before merging and resolve all review conversations.
4. Restrict force pushes and branch deletion.
5. Restrict who can push directly to `main`.
6. Require the `staging` Environment to have deployment reviewers; keep any future `production` Environment reviewer-gated.

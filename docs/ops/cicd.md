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

The audit job fails on `high` or `critical` production advisories; current pins include `follow-redirects@1.16.3` and `qs@6.16.2`. Backend E2E runs against ephemeral PostgreSQL/Redis and requires the `DB_MIGRATION_*` variables when production-style environment validation is exercised.

After a successful push to `main`, `Build and publish images` builds immutable GHCR images tagged with the commit SHA for the backend and all five web applications.

There is no automated deploy job. The host runs the Compose stack and is updated manually following [docs/deployment/production.md](../deployment/production.md). The workflow therefore requires no staging secrets and creates no GitHub deployment records.

If automated rollout is reintroduced later, it must pull the exact `NAPARE_IMAGE_PREFIX`/`NAPARE_IMAGE_TAG` pair built by the workflow, run behind a protected `staging` Environment, and be gated on `/api/v1/health` plus `scripts/verify-max-deployment.sh`.

## Production safety

There is deliberately no production deployment workflow. Production promotion must be a separate manually-dispatched workflow protected by a GitHub Environment with required reviewers, a verified staging release, and an approved rollback plan.

## Branch protection recommendations

The checked-in workflows do not reveal whether these repository settings are enabled. Verify rules and Environment reviewers in GitHub settings before relying on them.

Protect `main` with the following GitHub rules:

1. Require pull requests before merging and at least one approving review.
2. Require the `Lint`, `Typecheck`, `Unit tests and coverage`, `Backend E2E`, `Production application build`, and `Dependency security audit` checks.
3. Require branches to be up to date before merging and resolve all review conversations.
4. Restrict force pushes and branch deletion.
5. Restrict who can push directly to `main`.
6. Require the `staging` Environment to have deployment reviewers; keep any future `production` Environment reviewer-gated.

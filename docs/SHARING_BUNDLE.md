# Sharing a developer bundle

This guide describes a safe source handoff. No specific dated ZIP filename or prebuilt bundle is assumed to exist.

## Include

- Application source, package manifests and pnpm lockfiles.
- Documentation, source cards, CI configuration, deployment templates and scripts.
- Docker Compose manifests, Dockerfiles and unfilled example environment files.
- Git history through the configured Git remote when the recipient needs repository history.

## Exclude

| Exclude | Reason |
| --- | --- |
| .git when making a source-only archive | Git history should be shared through the remote unless a snapshot archive is explicitly required |
| node_modules, .next, dist, .turbo, coverage and other generated build/cache output | Regenerated from locked source and can be large |
| Filled .env files, credentials and tokens | Secrets must be transferred through a secure channel |
| Database dumps, Docker volumes and diagnostic bundles | May contain private or production data |
| Temporary office locks, render scratch and editor temp files | Not source inputs; preserve user deliverables separately |

Retain pnpm-lock.yaml, documentation and example environment templates. Check Git ignore rules and list the archive contents before sending it. Do not run a bulk deletion command against the workspace to prepare an archive.

## After extraction

1. Install the supported Node.js and pnpm versions from root package.json/README.
2. Run pnpm install --frozen-lockfile.
3. Copy an example environment file only when the chosen local/deployment workflow calls for it, then supply valid local values securely.
4. Use docs/01_ONBOARDING.md for development or root DEPLOY.md for an authorized server deployment.
5. MAX entry uses web-portal; the retained Vite apps/max-miniapp is not the deployed MAX client.

Never share the filled environment file or credentials alongside the bundle.

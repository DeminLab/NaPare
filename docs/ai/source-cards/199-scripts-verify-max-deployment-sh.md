# Source card: `scripts/verify-max-deployment.sh`

## Canonical source

`scripts/verify-max-deployment.sh`

## Scope

Read-only post-deploy smoke check that confirms `/` and `/max/` both serve the existing NaPare portal and load the MAX Bridge script. Detects the retired Vite mini-app by its `/max/assets/` bundle path.

## Read sequence

1. Read [deployment checks](../../../DEPLOY.md) and [the MAX client guide](../../clients/max-miniapp.md).
2. Read the script and inspect the public responses before interpreting a failed check.

## Change boundary

This script only makes unauthenticated GET requests to the configured public origin. It never sends credentials or changes server state. `MAX_PUBLIC_URL` can point it at a staging origin.

## Verification

```bash
bash -n scripts/verify-max-deployment.sh
bash scripts/verify-max-deployment.sh
```

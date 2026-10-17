# Source card: SIBIT teacher provisioning CLI

## Canonical source

`apps/backend/src/cli/provision-sibit-teachers.ts`

## Scope

Idempotently creates or links university teacher accounts from an email mapping and connects them to already-synchronized SIBIT lessons.

## Change boundary

Run `--dry-run` first. Require a SIBIT university ID and synced lesson rows, skip vacancy labels, keep passwords out of arguments and terminal output, and write generated temporary credentials to an exclusive owner-only file. Never point this command at an unverified university ID or a non-production-safe database.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```

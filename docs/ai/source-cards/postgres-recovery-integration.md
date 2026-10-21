# Source card: Real PostgreSQL restore drill test

## Canonical source

`scripts/test-postgres-recovery.integration.cjs`

## Scope

Opt-in disposable-cluster test for real pg_dump, AES-GCM archive, pg_restore, FORCE RLS preservation and nonempty-target refusal. Requires prepared fixture and marked isolated restore databases; does not contact production.

## Verification

```powershell
node --test scripts/test-postgres-recovery.integration.cjs
```

Prepare only a disposable cluster and set `RECOVERY_DRILL_ENABLE=true`, `PGHOST=127.0.0.1`, `PGDATABASE=napare_backup_fixture`, the source cluster user/port and PostgreSQL bin directory. A skipped test is not evidence of restoration.

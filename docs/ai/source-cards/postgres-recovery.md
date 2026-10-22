# Source card: PostgreSQL backup and restore

## Canonical source

`scripts/postgres-recovery.cjs`

## Scope

Streaming pg_dump encryption, named off-server rclone upload with read-back verification, and authenticated pg_restore into a marked empty loopback test database. Operational setup and limits are in [the runbook](../../deployment/runbook.md).

## Verification

```powershell
node --test scripts/test-postgres-recovery.cjs
node --test scripts/test-postgres-recovery.integration.cjs
```

The integration test skips without explicit `RECOVERY_DRILL_ENABLE=true` and a prepared disposable cluster; a skipped test is not runtime proof.

# Source card: External health monitor

## Canonical source

`scripts/monitor-health.cjs`

## Scope

External dependency-health probe, three-failure threshold, deduplicated generic webhook events and recovery notifications. Sending requires `MONITOR_SEND_ALERTS=true`; state belongs to one monitor process.

## Verification

```powershell
node --test scripts/test-postgres-recovery.cjs
```

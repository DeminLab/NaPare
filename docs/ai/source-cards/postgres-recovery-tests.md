# Source card: Recovery and monitoring safety tests

## Canonical source

`scripts/test-postgres-recovery.cjs`

## Scope

Synthetic archive authentication, rejection of production-like targets/local destinations, health response shape and alert state transitions without external delivery.

## Verification

```powershell
node --test scripts/test-postgres-recovery.cjs
```

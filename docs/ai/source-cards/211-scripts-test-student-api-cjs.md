# Source card: `scripts/test-student-api.cjs`

## Canonical source

`scripts/test-student-api.cjs`

## Scope

Regressions load the real transpiled student API client with Response fixtures, including empty personal notes after token refresh.

## Change boundary

Preserve API routes, authentication and response semantics.

## Verification

```powershell
node scripts/test-student-api.cjs
```

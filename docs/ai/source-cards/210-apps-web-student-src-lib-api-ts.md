# Source card: `apps/web-student/src/lib/api.ts`

## Canonical source

`apps/web-student/src/lib/api.ts`

## Scope

Student API client refreshes JWTs within 30 seconds of expiry before requests and shares one token refresh across concurrent requests, retries with rotated tokens and returns to the shared login if authentication still fails. Successful empty 200 responses become null, including retries; 204 remains undefined and malformed nonempty JSON is rejected. This prevents absent personal notes from looking like a network failure.

## Change boundary

Preserve API routes, authentication and response semantics.

## Verification

```powershell
node scripts/test-student-api.cjs
pnpm --filter @napare/web-student exec tsc --noEmit
```

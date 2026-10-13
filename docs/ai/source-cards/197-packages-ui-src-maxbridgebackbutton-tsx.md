# Source card: `packages/ui/src/MaxBridgeBackButton.tsx`

## Canonical source

`packages/ui/src/MaxBridgeBackButton.tsx`

The route adapters are `MaxBridgeNavigation.tsx` in student, staff, admin, and developer App Router roots/groups. Each root or role layout loads the MAX Bridge SDK.

## Scope

Connects MAX's native BackButton to each Next.js role application's internal route history. Native controls require nonempty SDK initData; merely loading the SDK does not invoke them. In a normal browser or when the SDK is unavailable, the component renders no UI and does not affect site navigation.

## Read sequence

1. Read [MAX launch and linking](../../clients/max-miniapp.md).
2. Review each role app's `MaxBridgeNavigation.tsx` for its home route and in-app history behavior.
3. Review the corresponding app root layout for SDK loading.

## Change boundary

Keep the BackButton handler attached only while visible and detach it on route changes/unmount. The site remains the canonical interface; MAX controls are additive and must degrade to no-op outside MAX.

## Verification

```powershell
pnpm --filter @napare/web-student exec tsc --noEmit
pnpm --filter @napare/web-staff exec tsc --noEmit
pnpm --filter @napare/web-admin exec tsc --noEmit
pnpm --filter @napare/web-developer exec tsc --noEmit
```

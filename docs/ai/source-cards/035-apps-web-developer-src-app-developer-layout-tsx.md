# Source card: `apps/web-developer/src/app/(developer)/layout.tsx`

## Canonical source

`apps/web-developer/src/app/(developer)/layout.tsx`

## Scope

Developer workspace groups system state, API, events and documentation, and distinguishes checking, successful health checks and unavailable verification. Includes mobile shortcuts. The October 16 revision removes the onboarding help configuration and applies content-scoped styling; the shared shell implementation is unchanged.

Navigation data includes `/control`; the shared header/navigation implementation is unchanged. Management permissions are checked by the platform API, not by the presence of this link.

## Read sequence

1. Start with [AI context](../../../AI_CONTEXT.md) and the relevant role or backend map.
2. Read this canonical source file.
3. Trace direct imports and its nearest caller before widening the investigation.

## Change boundary

Trace direct imports and the closest route or caller before changing this file.

## Verification

```powershell
pnpm --filter @napare/web-developer exec tsc --noEmit
```


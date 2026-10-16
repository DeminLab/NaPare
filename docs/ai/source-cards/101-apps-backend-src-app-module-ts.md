# Source card: `apps/backend/src/app.module.ts`

## Canonical source

`apps/backend/src/app.module.ts`

## Scope

NestJS module composition. Registers PlatformModule and the global maintenance interceptor; enabled read-only mode blocks mutating campus API requests while preserving auth and platform control. Read [platform control](../../product/platform-control.md).

## Read sequence

1. Start with [AI context](../../../AI_CONTEXT.md) and the relevant role or backend map.
2. Read this canonical source file.
3. Trace direct imports and its nearest caller before widening the investigation.

## Change boundary

Trace direct imports and the closest route or caller before changing this file.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```


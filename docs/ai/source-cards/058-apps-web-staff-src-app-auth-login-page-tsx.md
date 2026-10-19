# Source card: `apps/web-staff/src/app/(auth)/login/page.tsx`

## Canonical source

`apps/web-staff/src/app/(auth)/login/page.tsx`

## Scope

Staff workspace UI and its data flow.

The login form associates visible labels with email/password, uses username/current-password autocomplete, retains native required/email validation, and announces API failures through an assertive `role="alert"`. Error content is rendered without exposing credentials.

## Read sequence

1. Start with [AI context](../../../AI_CONTEXT.md) and the relevant role or backend map.
2. Read this canonical source file.
3. Trace direct imports and its nearest caller before widening the investigation.

## Change boundary

Trace direct imports and the closest route or caller before changing this file.

## Verification

```powershell
pnpm --filter @napare/web-staff exec tsc --noEmit
```

Synthetic local browser QA verified a mocked 401 alert, native required validation and no horizontal overflow at 320/390/768/1024/1440 px. Backend credentials, screen-reader output and production sign-in were not exercised.


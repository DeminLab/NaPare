# Source card: Portal home session restoration

## Canonical source

`apps/web-portal/src/components/HomeSessionRestore.tsx`

## Scope

On the public portal home page, verifies existing access tokens, refreshes an expired access token, and routes recognized roles to their existing cabinets. A full-page status gate prevents the public page from flashing before routing; if the session check takes longer than eight seconds or fails, the public home page is shown.

## Read sequence

1. [Portal home page](131-apps-web-portal-src-app-page-tsx.md).
2. This component and [the website login page](116-apps-web-portal-src-app-login-page-tsx.md).
3. [Android WebView client](../../clients/android-webview.md) for the mobile entry flow.

## Change boundary

Preserve existing API contracts and role destinations. Do not clear saved tokens on a transient session-service failure.

## Verification

Run the portal TypeScript check and repository lint. Browser session restoration still needs an authenticated runtime session.

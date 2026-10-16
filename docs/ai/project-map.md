# Project map

| Area | Responsibility | Start here |
| --- | --- | --- |
| `apps/backend` | API, authorization and data integration | `apps/backend/src` and `docs/api/README.md` |
| `apps/web`, `apps/max-miniapp` | Retained legacy clients; not routed by production Nginx/Compose and excluded from standard root `pnpm dev`/`pnpm build` | Historical configuration in `docs/architecture/config-files.md`; MAX uses `apps/web-portal` |
| `apps/web-portal` | Public product site and shared MAX launch / account-connection pages | `apps/web-portal/src/app` and `docs/clients/max-miniapp.md` |
| `apps/web-student` | Student experience | Protected from the role-workspace redesign; product features explicitly requested outside that redesign may change it |
| `apps/web-staff` | Teaching and daily learning operations | `apps/web-staff/src/app` |
| `apps/android-webview` | Android HTTPS WebView wrapper; independent Gradle build, website login and role routing | `apps/android-webview/README.md` |
| `apps/web-admin` | University control and schedule administration | `apps/web-admin/src/app` |
| `apps/web-developer` | Platform diagnostics and technical operations | `apps/web-developer/src/app` |
| `packages/*` | Shared contracts and API client code | package-level source cards |
| `infrastructure` | Reverse proxy and deployment support | infrastructure source cards |
| `apps/backend/src/curation`, `packages/ui/src/Curation.tsx` | Group assignments independent of primary roles; shared role screens | `docs/product/account-curatorship.md` |
| `apps/backend/src/platform`, `infrastructure/control` | Owner/delegated platform control and optional host agent | `docs/product/platform-control.md`, `docs/deployment/platform-control.md` |

The root scripts use pnpm workspaces. Docker uses a backend hostname only inside the Compose network; local browser development must use the local backend URL configuration documented in the application configs.

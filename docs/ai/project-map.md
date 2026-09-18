# Project map

| Area | Responsibility | Start here |
| --- | --- | --- |
| `apps/backend` | API, authorization and data integration | `apps/backend/src` and `docs/api/README.md` |
| `apps/web-student` | Student experience | Read-only during current redesign |
| `apps/web-staff` | Teaching and daily learning operations | `apps/web-staff/src/app` |
| `apps/web-admin` | University control and schedule administration | `apps/web-admin/src/app` |
| `apps/web-developer` | Platform diagnostics and technical operations | `apps/web-developer/src/app` |
| `packages/*` | Shared contracts and API client code | package-level source cards |
| `infrastructure` | Reverse proxy and deployment support | infrastructure source cards |

The root scripts use pnpm workspaces. Docker uses a backend hostname only inside the Compose network; local browser development must use the local backend URL configuration documented in the application configs.

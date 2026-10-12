# Search

`GET /api/v1/search?q=<term>` provides the authenticated role-scoped search. The query is trimmed and must contain 2–80 characters. Results include lessons, teachers, rooms, Pair Space preparation and file names, grouped by `type`; the endpoint returns at most eight results per type and 40 total.

The backend always applies the user's university scope. Students are restricted to their group, teachers to lessons assigned to their account, and university/developer roles to their tenant. Preparation and materials are reached only through tenant-matched Pair Space lessons and the same lesson scope. For SIBIT student accounts, schedule results come from the live Rasp source when the group's lessons are not persisted locally; result links open that group and week in the public group schedule.

Student and staff use one shared search dialog, opened with `Ctrl/⌘K` or the header search button. It combines local sections/actions with asynchronous scoped results, aborts obsolete requests, and keeps navigation available after a search API failure. Preparation and material results open the exact lesson tab. Legacy Spotlight components remain in source but are no longer mounted. Persisted lesson results open the current role's Pair Space; live Rasp results open the matching group and date. Search currently uses PostgreSQL `ILIKE` for persisted data and case-insensitive substring matching for the bounded SIBIT group schedule; no full-text index or fuzzy matching is configured.

## Sources

- [Search controller](../../apps/backend/src/search/search.controller.ts)
- [Search service](../../apps/backend/src/search/search.service.ts)
- [Shared workspace search](../../packages/ui/src/WorkspaceShell.tsx)
- [Safe result destinations](../../packages/ui/src/workspace-navigation.ts)
- [Legacy Student Spotlight](../../apps/web-student/src/app/%28student%29/StudentSpotlight.tsx)
- [Legacy Staff Spotlight](../../apps/web-staff/src/app/%28staff%29/StaffSpotlight.tsx)

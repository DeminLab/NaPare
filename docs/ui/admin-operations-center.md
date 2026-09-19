# University Operations Center

The admin workspace is organized around operational context rather than CRUD pages:

- **Overview** loads tenant-scoped users, groups, faculties, today’s schedule, notifications, health, and sync status. Problems are computed from missing rooms, duplicate room/time slots, unmapped teachers, import/error notifications, unread events, and sync errors.
- **Schedule Import** follows `Upload → Detect → Map → Validate → Preview → Apply → Sync`. Apply is disabled when validation finds conflicts and the operator must confirm the preview before the existing import endpoint is called.
- **Connector Center** uses `/admin/connectors` so university administrators do not call the superadmin-only connector API. Existing connector telemetry remains explicitly marked unavailable until the backend stores sync duration, record counts, and history.
- **Structure** presents `Faculty → Group → Users` with search and selection for future bulk actions.
- **Audit Log** reads `/admin/audit-log` and renders actor, action, timestamp, source, old values, and new values. Backend results are scoped to users belonging to the current university.

## Backend contract notes

The current schedule upload service accepts file metadata and imports an empty lesson list; it does not yet accept file content or persist an import diff. The UI therefore keeps local parsing for CSV/JSON preview and does not claim server-side Excel detection. Connector definitions are currently service-backed records without persistent telemetry. These are explicit follow-up contracts, not fake UI success states.

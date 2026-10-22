# Student semester page

## Canonical source

`apps/web-student/src/app/(student)/semester/page.tsx`

## Scope

Read-only student report from the scoped semester API. Loads configured periods and ten courses per page, shows source/time, preserves zero grades, labels hidden/stale/unavailable records. No debt inference from grades and no local storage of the report. Profile content links here; navigation components remain unchanged.

## Read sequence

1. [Moodle semester integration](../../integrations/moodle-semester.md).
2. [Backend aggregation](semester-service.md).
3. The canonical source and student API client.

## Verification

Run student TypeScript, root lint and documentation/boundary guards. Browser fixtures verify rendering and interactions separately from the PostgreSQL-backed semester API tests. Neither proves a live university Moodle connection.

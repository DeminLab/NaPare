# Academic Context API

The academic API is the normalized compatibility layer for the university learning domain. It keeps the existing schedule and Pair Space contracts intact while exposing stable resources for course context, recurring lesson series, concrete lesson occurrences, schedule changes, and domain events.

Base path: `/api/v1/academic`

## Resources

| Resource | Endpoints | Scope |
|---|---|---|
| Course | `GET/POST /courses`, `GET/PATCH /courses/:id` | university operators; read is resource-scoped for students, teachers, and curators |
| Course Space | `GET /courses/:courseId/space` | same scope as the course |
| Lesson Series | `GET/POST /courses/:courseId/series` | teacher/curator resource scope or university operator |
| Lesson Occurrence | `GET /occurrences`, `GET /occurrences/:id/context`, `POST /series/:seriesId/occurrences`, `PATCH /occurrences/:id` | group, teacher, curator, or university scope |
| Lesson Space | `GET /occurrences/:id/space` | same scope as the occurrence |
| Schedule Change | `GET /occurrences/:id/changes` | occurrence scope |
| Academic Event | `GET/POST /events` | course/group/occurrence scope |

All collection endpoints use the standard `page`/`limit` pagination response. All university-scoped requests are checked through the tenant context and then filtered by the caller's resource scope.

## Compatibility model

`Lesson` remains available through `/api/v1/schedule`. Existing records are backfilled into `Course → LessonSeries → LessonOccurrence`; the legacy lesson stores links to the normalized records. `PairSpace` remains compatible with existing lesson routes and is linked to the normalized `LessonSpace` where possible. `CourseSpace` is the long-lived subject space; `LessonSpace` is the context for a particular class meeting.

## Provenance and schedule changes

Critical academic records expose `source`, `lastSyncedAt`, `sourceVersion`, and `syncStatus`. An occurrence update writes a normalized schedule-change record containing `originalValue`, `newValue`, `reason`, `actorId`, `source`, and `timestamp` in the same transaction as the occurrence update. The event bus then publishes the canonical change event for realtime, notification, audit, and analytics consumers.

## Authorization

The module uses `Role → Permission → Resource Scope`. Permission metadata is enforced by `PermissionsGuard`; `AcademicService` repeats the resource checks at the service boundary. A teacher is limited to their own series/occurrences, a curator to groups assigned to them, students to their group, university operators to their tenant, and developers to technical resources rather than academic records.

OpenAPI is generated from the NestJS controller and DTO decorators at `/api/v1/docs-json`; this page documents the domain boundaries and does not duplicate the generated schema.

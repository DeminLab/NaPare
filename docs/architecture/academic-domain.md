# Academic domain context

NaPare now has a normalized academic context without removing the legacy schedule API:

```text
University
  └─ Faculty
      └─ Group
          └─ Course
              ├─ Course Space       (long-lived subject context)
              └─ Lesson Series      (recurring rule)
                  └─ Lesson Occurrence (one concrete date/time)
                      └─ Lesson Space / legacy PairSpace
```

`Course` is the durable subject identity. `LessonSeries` owns recurrence, regular time, group and teacher. `LessonOccurrence` owns one concrete date, room, status and an optional legacy `Lesson` link. This prevents a single row from mixing curriculum identity, recurrence and a changed occurrence.

## Compatibility strategy

- Existing `Lesson` rows remain valid and existing `/schedule` routes remain unchanged.
- Migration `1700000000004-AcademicContext` backfills courses, series, occurrences and course spaces from legacy lessons.
- Legacy lessons receive nullable `courseId`, `seriesId`, and `occurrenceId` links plus provenance fields.
- Legacy lesson updates mirror room/time/status changes into the normalized occurrence and write both legacy and normalized schedule history.
- Existing `PairSpace` remains compatible and now has nullable `courseId`/`lessonOccurrenceId`/`lessonSpaceId` links. `CourseSpace` is the long-lived subject space; `LessonSpace` is the normalized context for one occurrence and is created for new occurrences.

## Academic Events

`academic_events` is a queryable domain projection for lesson, homework, exam, announcement, schedule change, absence, university event and personal task context. It is deliberately separate from the transport event log:

- `academic_events` answers “what exists in the academic timeline?”
- `event_records` answers “what changed and what must be delivered in realtime?”

Both can be consumed by notifications, analytics, audit and future AI context without making those consumers depend on Pair Space internals.

## Provenance

Courses, series, occurrences, lessons, Pair Spaces, homework, announcements and absences expose:

- `source`;
- `lastSyncedAt`;
- `sourceVersion`;
- `syncStatus` (`unknown`, `synced`, `stale`, `failed`).

Schedule changes additionally store `originalValue`, `newValue`, `reason`, `actorId`, `source`, and `timestamp`.

## Authorization

The academic API uses `Role → Permission → Resource Scope`:

- university operators manage the catalog within their university;
- teachers read and manage their own series/occurrences;
- curators are restricted to groups where they are curator;
- students are restricted to series/occurrences for their group;
- developers receive technical permission only and do not inherit academic access.

Permission metadata is enforced by `PermissionsGuard`; resource scope is enforced again inside `AcademicService`, so service calls cannot bypass controller guards.

## Consistency and performance

- Course creation and its Course Space are committed in one transaction.
- Occurrence update and normalized schedule-change history are committed in one transaction.
- Occurrences have unique `(seriesId, startsAt)` identity and indexed university/group/course time queries.
- Course/occurrence/event listing uses scoped query builders instead of loading all rows and filtering in memory.
- Legacy and normalized writes are idempotent by stable links; migration backfill uses conflict-safe inserts.
- Domain transport events keep the previous event envelope, while callers can provide an idempotency key; normalized schedule changes use their persisted change id as that key. Notification and inbox fan-out remain protected by their existing event/user unique indexes.

New endpoints are available under `/api/v1/academic` and are included in generated Swagger/OpenAPI because they are declared through Nest decorators.

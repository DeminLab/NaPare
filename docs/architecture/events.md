# NaPare event model

NaPare treats a successful domain mutation as an event. The event is written to the durable `event_records` log before it is fanned out to notifications, Inbox items, and the realtime stream. This keeps delivery retryable and makes reconnect/offline replay possible.

## Canonical envelope

```ts
{
  id: string,
  type: NapareEventType,
  actor: { id?: string, type: 'user' | 'system', role?: string },
  timestamp: string,
  university: { id: string },
  target: { type: string, id: string },
  payload: Record<string, unknown>,
  priority: 'low' | 'normal' | 'high' | 'urgent',
  recipients?: string[]
}
```

Supported event types are `lesson.changed`, `lesson.cancelled`, `lesson.rescheduled`, `room.changed`, `homework.created`, `homework.updated`, `homework.deadline_soon`, `announcement.created`, `message.created`, `absence.created`, `absence.updated`, `attendance.updated`, `grade.created`, `sync.completed`, and `sync.failed`.

`recipients` is optional. Without it, the event is scoped to the university and the notification handler resolves active recipients. A lesson event can include `groupId` and `teacherId` in its payload so only affected users receive it.

## Delivery flow

```text
domain mutation
  -> EventBusService.publish()
  -> event_records (durable)
  -> napare.event
      -> NotificationEventHandler
          -> Notification (informational)
          -> InboxItem (actionable, only where action is required)
      -> SSE stream /api/v1/events/stream
```

The `EventEmitter2` channel is an in-process fan-out mechanism. The durable event log is the source for replay; in a horizontally scaled deployment, the in-process dispatch should be backed by Redis/NATS pub-sub so a stream connected to another instance receives the event immediately.

## Realtime and replay

- `GET /api/v1/events` returns events after an optional `since` ISO timestamp.
- `GET /api/v1/events/stream` is an authenticated SSE stream.
- The stream sends `id`, `type`, and the full envelope as `data`.
- Heartbeats are sent every 30 seconds.
- The shared `@napare/api-client` uses authenticated `fetch()` streaming rather than native `EventSource`, because bearer tokens cannot be attached to native EventSource requests.

## Notification vs Inbox

These are intentionally separate:

- Notification: “Аудитория изменена” — informs the user and deep-links to the object.
- Inbox item: “Проверь новую аудиторию” — an actionable item with `open`, `snoozed`, and `done` states.

Notification preferences and quiet hours suppress notification creation only. They do not remove the event from the event log, so a later replay cannot silently lose a schedule change.

## Offline contract

`@napare/api-client` exposes event replay, authenticated realtime subscription, and a versioned local snapshot/cursor helper. The intended client flow is:

1. Render the last local snapshot with `offline` or `stale` status.
2. Request `/events?since=<cursor>` when connectivity returns.
3. Apply domain updates transactionally, advance the cursor only after the snapshot is persisted, then reconnect the SSE stream.
4. Mark the snapshot `synced` only after replay and the current data queries complete.

The current repository boundary forbids changes under `apps/web-student/**`, so the student app is not wired to this contract in this change. The backend, shared API types, replay endpoint, and offline storage primitives are ready for that integration. Until the boundary is lifted, student runtime offline behavior remains an explicit follow-up rather than an unverified claim.

## Producers currently wired

- Schedule updates, deletions, imports, and change detection: lesson/schedule events and sync status.
- Pair Space announcements, homework, messages, and homework completion.
- Student absence creation and staff decisions.
- Admin schedule sync endpoint.

`homework.deadline_soon`, `attendance.updated`, and `grade.created` are defined in the canonical contract and notification mapping. The current backend has no scheduler for deadline scans and no attendance/grade write model, so no producer is invented for them; they are explicit next integration points rather than silent polling or fabricated data.

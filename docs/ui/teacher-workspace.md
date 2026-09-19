# Teacher Workspace

Teacher Workspace uses the shared `@napare/ui` foundation and keeps the teacher's daily work in two contexts: **Today** for triage and **Pair Space** for execution.

## Surface model

- **Today**: `/today` answers what is happening now, what is next, and what needs attention. It consumes `GET /my-day` and `GET /notifications`.
- **Pair Space**: `/pair-space/:lessonId` exposes overview, materials, assignments, and discussion without leaving the lesson context.
- **Inbox**: `/inbox` groups notification events into messages, attendance, schedule, work, and reminders. It reuses `GET /notifications`.
- **Attendance**: `/attendance` keeps the fast mark/save workflow and consumes the existing group-student and absence APIs.

## Existing API actions used

- `GET /my-day` — teacher schedule, pair spaces, change summary, unread count.
- `GET /pair-spaces/:lessonId` and `GET /schedule/lessons/:lessonId` — lesson context.
- `POST /pair-spaces/:lessonId/announcements` — publish announcement.
- `POST /pair-spaces/:lessonId/homeworks` — publish homework immediately.
- `POST /pair-spaces/:lessonId/files` — attach a file URL and metadata.
- `POST /pair-spaces/:lessonId/messages` — send a group discussion message.
- `GET/POST /absences` and `GET /absences/lesson/:lessonId` — attendance state.

## Explicit backend gaps

The current contracts do not provide teacher-scoped group aggregation, polls, link resources, file multipart upload, homework drafts/points/closed transitions, attendance history, or a separate inbox feed. The UI therefore does not pretend these actions are persisted: unsupported Pair Space actions are disabled with an explanation, and the homework UI reports that the current endpoint publishes immediately. These capabilities should be added as separate domain contracts before enabling their controls.

All new teacher surfaces use shared loading skeletons, retryable request states, empty states, status feedback, focusable controls, and responsive layouts. No student routes or protected navigation components are part of this teacher change.

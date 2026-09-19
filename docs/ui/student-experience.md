# Student Experience

NaPare student workspace is organized around the operating system of a study day:

1. what is happening now;
2. what happens next;
3. what needs attention;
4. what changed.

## Current surfaces

- /today is the day command center: current/next lesson, day timeline, Action Center, deadlines and changes.
- /week keeps the existing schedule API and provides week and agenda/list views.
- /pair-space/[lessonId] is the learning context with Overview, Materials, Assignments, Discussion, Attendance, Grades and Notes.
- /notifications remains the source of notification history and read state.
- /absences remains the source of absence reporting and approval state.

The student shell uses the same @napare/ui WorkspaceShell, tokens and icon registry as the other role workspaces. Student-specific navigation data remains local so role permissions and available routes are not inferred by the shared presentation layer.

## Existing API usage

The experience currently uses:

- GET /my-day;
- GET /users/me;
- GET /notifications and the existing read-state mutations;
- GET /schedule/range;
- GET /schedule/lessons/:id;
- GET /pair-spaces/:lessonId;
- PATCH /pair-spaces/homeworks/:id/submit;
- GET/POST /pair-spaces/:lessonId/messages;
- GET/POST /absences.

## Backend gaps

The current backend does not expose student-specific attendance records for a lesson or grades/exams/task entities. Those areas therefore render explicit empty states and do not fabricate values. To complete them, add dedicated contracts for lesson attendance, gradebook/exams and personal tasks, then pass those results into the existing Pair Space and Action Center composition.

The current My Day response supplies Pair Space homework/announcement data, schedule, absences and unread count. It does not yet return a first-class aggregated Action Center, so the client composes that list from the existing response and notifications.

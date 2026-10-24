# Матрица ролей и входного контроля API

Справочник текущей реализации на 22 октября 2026 года. В `UserRole` **11 ролей**. Матрица фиксирует входной контроль guards, а не полный доступ к данным.

Источники: [роли](../../apps/backend/src/auth/interfaces/user-role.ts), [ROLE_PERMISSIONS](../../apps/backend/src/common/authorization/permissions.ts), [маршрутные decorators и guards](../../apps/backend/src/common/guards/roles.guard.ts).

## Как читать и проверять

- `200` — реальные guards допустили запрос к синтетическому HTTP probe. Контроллеры, DTO, сервисы, БД, resource ownership, tenant isolation, platform grants, maintenance и rate limits в этом probe не исполняются. Реальный endpoint может вернуть 201/204/400/403/404 и другие ответы.
- `403` — реальная входная проверка отклонила эту роль. `401` — каждый защищённый маршрут проверяется без JWT и с неверной подписью JWT.
- JWT подписан локальным тестовым ключом; реальный JwtStrategy проверяет claims по in-memory UsersService. Это HTTP/JWT/guard proof, а не PostgreSQL или production proof.
- В матрице обычные роли привязаны к одному тестовому вузу; employer/career_staff/career_admin не имеют вуза. Отдельные тесты проверяют developer/superadmin без вуза. Кураторские назначения, гранты платформы и сервисные ограничения не выводятся из основной роли.
- Автоматическое перечисление читает все `*.controller.ts`, class/method guards и override metadata. Незащищённые исходные объявления приведены отдельно. Snapshot блокирует незаметное изменение маршрутов, guards, enum и разрешений.

```powershell
pnpm --filter @napare/backend exec jest --config ./test/jest-e2e.json --runInBand role-policy.e2e-spec
# После осознанного review изменения ACL обновить snapshot и этот справочник:
pnpm --filter @napare/backend exec ts-node --transpile-only test/update-role-policy.ts
```

Файлы: [HTTP tests](../../apps/backend/test/role-policy.e2e-spec.ts), [зафиксированный baseline](../../apps/backend/test/fixtures/role-policy.json). Тесты сравнивают актуальную metadata с baseline до проверки HTTP; generator никогда не запускается автоматически в CI.

## Разрешения ROLE_PERMISSIONS

| Роль | Разрешения |
| --- | --- |
| `student` | `academic.course.read`, `academic.series.read`, `academic.occurrence.read`, `academic.event.read` |
| `employer` | Нет разрешений из этого набора |
| `career_staff` | Нет разрешений из этого набора |
| `career_admin` | Нет разрешений из этого набора |
| `teacher` | `academic.course.read`, `academic.series.read`, `academic.occurrence.read`, `academic.event.read`, `academic.series.manage`, `academic.occurrence.manage` |
| `curator` | `academic.course.read`, `academic.series.read`, `academic.occurrence.read`, `academic.event.read` |
| `faculty_dean` | `academic.course.read`, `academic.series.read`, `academic.occurrence.read`, `academic.event.read`, `academic.course.manage`, `academic.series.manage`, `academic.occurrence.manage`, `academic.event.manage` |
| `department_head` | `academic.course.read`, `academic.series.read`, `academic.occurrence.read`, `academic.event.read`, `academic.course.manage`, `academic.series.manage`, `academic.occurrence.manage`, `academic.event.manage` |
| `university_admin` | `academic.course.read`, `academic.series.read`, `academic.occurrence.read`, `academic.event.read`, `academic.course.manage`, `academic.series.manage`, `academic.occurrence.manage`, `academic.event.manage` |
| `superadmin` | `academic.course.read`, `academic.course.manage`, `academic.series.read`, `academic.series.manage`, `academic.occurrence.read`, `academic.occurrence.manage`, `academic.event.read`, `academic.event.manage`, `technical.resource.read` |
| `developer` | `technical.resource.read` |

Этот набор применяется PermissionsGuard к academic API. Большинство остальных API используют @Roles либо сервисные проверки. Отсутствие разрешений из этого набора не означает запрет всех API.

## Защищённые маршруты

| Маршрут | Guards | student | employer | career_staff | career_admin | teacher | curator | faculty_dean | department_head | university_admin | superadmin | developer |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `POST /api/v1/absences/attendance/qr-check-in` | JwtAuthGuard, RolesGuard | 200 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 |
| `POST /api/v1/absences/:id/confirm` | JwtAuthGuard, RolesGuard | 403 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 403 |
| `POST /api/v1/absences` | JwtAuthGuard, RolesGuard | 200 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 |
| `POST /api/v1/absences/attendance/qr-sessions` | JwtAuthGuard, RolesGuard | 403 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 403 |
| `DELETE /api/v1/absences/:id` | JwtAuthGuard, RolesGuard | 200 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 |
| `POST /api/v1/absences/:id/excuse` | JwtAuthGuard, RolesGuard | 403 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 403 |
| `GET /api/v1/absences/attendance/lesson/:lessonId` | JwtAuthGuard, RolesGuard | 403 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 403 |
| `GET /api/v1/absences/lesson/:lessonId` | JwtAuthGuard, RolesGuard | 403 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 403 |
| `GET /api/v1/absences/student/:studentId` | JwtAuthGuard, RolesGuard | 403 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 403 |
| `GET /api/v1/absences/my` | JwtAuthGuard, RolesGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/absences/pending` | JwtAuthGuard, RolesGuard | 403 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 403 |
| `GET /api/v1/absences/stats/:studentId` | JwtAuthGuard, RolesGuard | 403 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 403 |
| `POST /api/v1/absences/attendance` | JwtAuthGuard, RolesGuard | 403 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 403 |
| `PATCH /api/v1/absences/:id` | JwtAuthGuard, RolesGuard | 200 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 |
| `POST /api/v1/academic/events` | JwtAuthGuard, PermissionsGuard | 403 | 403 | 403 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 403 |
| `POST /api/v1/academic/courses` | JwtAuthGuard, PermissionsGuard | 403 | 403 | 403 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 403 |
| `POST /api/v1/academic/series/:seriesId/occurrences` | JwtAuthGuard, PermissionsGuard | 403 | 403 | 403 | 403 | 200 | 403 | 200 | 200 | 200 | 200 | 403 |
| `POST /api/v1/academic/courses/:courseId/series` | JwtAuthGuard, PermissionsGuard | 403 | 403 | 403 | 403 | 200 | 403 | 200 | 200 | 200 | 200 | 403 |
| `GET /api/v1/academic/events` | JwtAuthGuard, PermissionsGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 403 |
| `GET /api/v1/academic/courses` | JwtAuthGuard, PermissionsGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 403 |
| `GET /api/v1/academic/occurrences` | JwtAuthGuard, PermissionsGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 403 |
| `GET /api/v1/academic/courses/:courseId/series` | JwtAuthGuard, PermissionsGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 403 |
| `GET /api/v1/academic/courses/:id` | JwtAuthGuard, PermissionsGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 403 |
| `GET /api/v1/academic/courses/:courseId/space` | JwtAuthGuard, PermissionsGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 403 |
| `GET /api/v1/academic/occurrences/:id/space` | JwtAuthGuard, PermissionsGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 403 |
| `GET /api/v1/academic/occurrences/:id/context` | JwtAuthGuard, PermissionsGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 403 |
| `GET /api/v1/academic/occurrences/:id/changes` | JwtAuthGuard, PermissionsGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 403 |
| `PATCH /api/v1/academic/courses/:id` | JwtAuthGuard, PermissionsGuard | 403 | 403 | 403 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 403 |
| `PATCH /api/v1/academic/occurrences/:id` | JwtAuthGuard, PermissionsGuard | 403 | 403 | 403 | 403 | 200 | 403 | 200 | 200 | 200 | 200 | 403 |
| `POST /api/v1/admin/connectors/moodle/configure` | JwtAuthGuard, RolesGuard | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 200 | 200 | 403 |
| `POST /api/v1/admin/faculties` | JwtAuthGuard, RolesGuard | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 200 | 200 | 403 |
| `POST /api/v1/admin/groups` | JwtAuthGuard, RolesGuard | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 200 | 200 | 403 |
| `POST /api/v1/admin/users` | JwtAuthGuard, RolesGuard | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 200 | 200 | 403 |
| `GET /api/v1/admin/attendance-groups` | JwtAuthGuard, RolesGuard | 403 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 403 |
| `GET /api/v1/admin/audit-log` | JwtAuthGuard, RolesGuard | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 200 | 200 | 403 |
| `GET /api/v1/admin/connectors` | JwtAuthGuard, RolesGuard | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 200 | 200 | 403 |
| `GET /api/v1/admin/faculties` | JwtAuthGuard, RolesGuard | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 200 | 200 | 403 |
| `GET /api/v1/admin/groups` | JwtAuthGuard, RolesGuard | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 200 | 200 | 403 |
| `GET /api/v1/admin/groups/:id/students` | JwtAuthGuard, RolesGuard | 403 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 403 |
| `GET /api/v1/admin/schedule/imports/:id` | JwtAuthGuard, RolesGuard | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 200 | 200 | 403 |
| `GET /api/v1/admin/schedule/imports/:id/changes` | JwtAuthGuard, RolesGuard | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 200 | 200 | 403 |
| `GET /api/v1/admin/sibit/teachers` | JwtAuthGuard, RolesGuard | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 200 | 200 | 403 |
| `GET /api/v1/admin/stats` | JwtAuthGuard, RolesGuard | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 200 | 200 | 403 |
| `GET /api/v1/admin/schedule/sync-status` | JwtAuthGuard, RolesGuard | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 200 | 200 | 403 |
| `GET /api/v1/admin/university` | JwtAuthGuard, RolesGuard | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 200 | 200 | 403 |
| `GET /api/v1/admin/users` | JwtAuthGuard, RolesGuard | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 200 | 200 | 403 |
| `PATCH /api/v1/admin/users/:id/sibit-teacher` | JwtAuthGuard, RolesGuard | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 200 | 200 | 403 |
| `POST /api/v1/admin/users/:id/reset-password` | JwtAuthGuard, RolesGuard | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 200 | 200 | 403 |
| `POST /api/v1/admin/schedule/sync` | JwtAuthGuard, RolesGuard | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 200 | 200 | 403 |
| `POST /api/v1/admin/connectors/moodle/test` | JwtAuthGuard, RolesGuard | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 200 | 200 | 403 |
| `PATCH /api/v1/admin/connectors/:id` | JwtAuthGuard, RolesGuard | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 200 | 200 | 403 |
| `PATCH /api/v1/admin/faculties/:id` | JwtAuthGuard, RolesGuard | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 200 | 200 | 403 |
| `PATCH /api/v1/admin/groups/:id` | JwtAuthGuard, RolesGuard | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 200 | 200 | 403 |
| `PATCH /api/v1/admin/university` | JwtAuthGuard, RolesGuard | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 200 | 200 | 403 |
| `PATCH /api/v1/admin/users/:id/roles` | JwtAuthGuard, RolesGuard | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 200 | 200 | 403 |
| `PATCH /api/v1/admin/users/:id/status` | JwtAuthGuard, RolesGuard | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 200 | 200 | 403 |
| `POST /api/v1/admin/schedule/upload` | JwtAuthGuard, RolesGuard | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 200 | 200 | 403 |
| `POST /api/v1/auth/telegram/link` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/auth/max/status` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/auth/telegram/status` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/auth/max/link` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/auth/logout` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/career/ai/status` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/career/tasks/:id/apply` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/career/tasks/:id/approve` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/career/center/assignable-staff` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/career/tests/:id/attempts` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/career/portfolio/:id/ai-draft` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/career/center/reviews` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/career/companies` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/career/tasks` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/career/tests` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/career/admissions/:id/decision` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/career/works/:id/decision` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/career/memberships` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/career/notices` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/career` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/career/companies/:id/partnerships` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/career/partnership-eligibility` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/career/partnerships` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/career/planning` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PATCH /api/v1/career/portfolio/:id` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/career/tasks/:id/publish` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/career/notices/:id/read` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/career/admissions` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/career/works/:id/review` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PUT /api/v1/career/availability` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PUT /api/v1/career/portfolio/:id/description` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PUT /api/v1/career/profile` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/career/applications/:id/select` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/career/student/admissions` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/career/student/portfolio` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/career/works/:id/submit` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/career/ai/task-draft` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/career/tasks` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/career/tests` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/career/universities` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/career/notices/unread-count` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/career/partnerships/:id/verify` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/career/profiles/:id/verify` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/career/workflows` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/career/tasks/:id/complaints` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/career/moderation/complaints` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/career/moderation/tasks/:id/decision` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/career/complaints/my` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/career/moderation/complaints/:id/decision` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PATCH /api/v1/career/tasks/:id` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/career/moderation/tasks` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/career/center/report.xlsx` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/career/center/report` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/career/companies/:id/registry-check` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/curation/absences/:id/context` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/curation/absences` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/curation/manage/candidates` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/curation/context` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/curation/groups/:groupId/curators` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PUT /api/v1/curation/groups/:groupId/curators/:userId` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/curation/groups` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/curation/groups/:groupId/lessons` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/curation/manage/groups` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `DELETE /api/v1/curation/groups/:groupId/curators/:userId` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/curation/groups/:groupId/students` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PATCH /api/v1/curator/absences/:id/confirm` | JwtAuthGuard, RolesGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/curator/absences` | JwtAuthGuard, RolesGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PATCH /api/v1/curator/absences/:id/reject` | JwtAuthGuard, RolesGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/devices/token` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `DELETE /api/v1/devices/token` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/events` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/events/stream` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/users/me/favorites` | JwtAuthGuard, RolesGuard | 200 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 |
| `GET /api/v1/users/me/favorites` | JwtAuthGuard, RolesGuard | 200 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 |
| `DELETE /api/v1/users/me/favorites` | JwtAuthGuard, RolesGuard | 200 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 |
| `GET /api/v1/my-day` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PATCH /api/v1/notifications/inbox/:id/complete` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/notifications` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/notifications/inbox` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/notifications/preferences` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/notifications/unread-count` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/notifications/read-all` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PATCH /api/v1/notifications/:id/read` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PATCH /api/v1/notifications/inbox/:id/snooze` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PATCH /api/v1/notifications/preferences` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/pair-spaces/:lessonId/announcements` | JwtAuthGuard, RolesGuard | 403 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 403 |
| `POST /api/v1/pair-spaces/:lessonId/homeworks` | JwtAuthGuard, RolesGuard | 403 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 403 |
| `POST /api/v1/pair-spaces/:lessonId/messages` | JwtAuthGuard, RolesGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/pair-spaces/:lessonId` | JwtAuthGuard, RolesGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/pair-spaces/:lessonId/messages` | JwtAuthGuard, RolesGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/pair-spaces/:lessonId/personal-note` | JwtAuthGuard, RolesGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/pair-spaces/:lessonId/timeline` | JwtAuthGuard, RolesGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/pair-spaces/groups/:groupId` | JwtAuthGuard, RolesGuard | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 200 | 200 | 403 |
| `PUT /api/v1/pair-spaces/:lessonId/personal-note` | JwtAuthGuard, RolesGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PATCH /api/v1/pair-spaces/homeworks/:id/submit` | JwtAuthGuard, RolesGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PATCH /api/v1/pair-spaces/homeworks/:id/progress` | JwtAuthGuard, RolesGuard | 200 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 |
| `POST /api/v1/pair-spaces/:lessonId/files` | JwtAuthGuard, RolesGuard | 403 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 403 |
| `POST /api/v1/career/payments` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/career/payments/:id` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/career/payments/:id/history` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/career/payments` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/career/payments/options` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/career/payments/:id/refresh` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/career/payments/:id/refund` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-academic/catalog/courses/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-academic/catalog/series/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-academic/catalog/courses` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-academic/catalog/series` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-academic/catalog/options` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PATCH /api/v1/platform-academic/catalog/courses/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PATCH /api/v1/platform-academic/catalog/series/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-academic/occurrences/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-academic/occurrences` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PATCH /api/v1/platform-academic/occurrences/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-academic/events/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/platform-academic/events/:id/hide` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-academic/events` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/platform-academic/events/:id/restore` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PATCH /api/v1/platform-academic/events/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-academic/lessons/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-academic/lessons` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PATCH /api/v1/platform-academic/lessons/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-attachments/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-attachments` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PATCH /api/v1/platform-attachments/:id/restore` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PATCH /api/v1/platform-attachments/:id/revoke` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-attendance-qr/sessions` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PATCH /api/v1/platform-attendance-qr/sessions/:id/revoke` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-career/admissions/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-career/admissions` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-career/availability` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-career/availability/:studentId` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-career/companies` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-career/companies/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/platform-career/admissions/:id/decision` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/platform-career/partnerships/:id/decision` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/platform-career/profiles/:id/decision` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-career/memberships` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-career/notices/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-career/notices` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-career/partnerships/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-career/partnerships` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PATCH /api/v1/platform-career/admissions/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PATCH /api/v1/platform-career/availability/:studentId` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PATCH /api/v1/platform-career/companies/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PATCH /api/v1/platform-career/notices/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PATCH /api/v1/platform-career/portfolios/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PATCH /api/v1/platform-career/profiles/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PATCH /api/v1/platform-career/reviews/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PATCH /api/v1/platform-career/tasks/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PATCH /api/v1/platform-career/tests/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-career/portfolios/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-career/portfolios` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-career/profiles/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-career/profiles` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-career/reviews/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-career/reviews` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/platform-career/memberships/:id/revoke` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-career/tasks/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-career/tasks` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-career/tests/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-career/tests/attempts` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-career/tests` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/platform-career/memberships/:id/transfer-owner` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-career/applications/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-career/applications` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/platform-career/applications/:id/decision` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/platform-career/works/:id/decision` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PATCH /api/v1/platform-career/applications/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PATCH /api/v1/platform-career/works/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-career/works/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-career/works` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform/access` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform/accounts/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform/accounts` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform/audit` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/platform/accounts` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/platform/organization/faculties` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/platform/organization/groups` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/platform/universities` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/platform/trust/emergency-revoke` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PUT /api/v1/platform/permissions/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform/permissions` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform/groups` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform/jobs/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform/jobs` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform/services/:service/logs` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform/organization/faculties` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform/organization/groups` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/platform/accounts/:id/password` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/platform/accounts/:id/revoke-sessions` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/platform/accounts/:id/identity/telegram/revoke` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform/services` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform/settings` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/platform/jobs` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform/universities` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/platform/accounts/:id/identity/max/unlink` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PATCH /api/v1/platform/accounts/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PUT /api/v1/platform/organization/faculties/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PUT /api/v1/platform/organization/groups/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PUT /api/v1/platform/settings` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PUT /api/v1/platform/universities/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-curation/assignments/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-curation/assignments` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-curation/candidates` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/platform-curation/assignments` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-curation/groups` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PATCH /api/v1/platform-curation/assignments/:id/revoke` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-data/absence-confirmations/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-data/absence-confirmations` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-data/absences` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-data/attendance` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PATCH /api/v1/platform-data/absences/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PATCH /api/v1/platform-data/absence-confirmations/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PATCH /api/v1/platform-data/attendance/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-discussions/messages/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-discussions/messages` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/platform-discussions/messages/:id/moderation` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PATCH /api/v1/platform-discussions/messages/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-events/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-events` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PATCH /api/v1/platform-homework/submissions/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-homework/submissions/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-homework/submissions` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-notifications/devices` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PATCH /api/v1/platform-notifications/records/:kind/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-notifications/records/:kind/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-notifications/records` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PATCH /api/v1/platform-notifications/devices/:id/revoke` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-pair-space/announcements/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-pair-space/announcements` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PATCH /api/v1/platform-pair-space/announcements/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PATCH /api/v1/platform-pair-space/spaces/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-pair-space/spaces/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-pair-space/spaces` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `DELETE /api/v1/platform-records/users/:userId/favorites/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `DELETE /api/v1/platform-records/users/:userId/homework-progress/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `DELETE /api/v1/platform-records/users/:userId/lesson-notes/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `DELETE /api/v1/platform-records/users/:userId/preferences/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PATCH /api/v1/platform-records/users/:userId/favorites/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PATCH /api/v1/platform-records/users/:userId/homework-progress/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PATCH /api/v1/platform-records/users/:userId/lesson-notes/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PATCH /api/v1/platform-records/users/:userId/preferences/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PUT /api/v1/platform-records/users/:userId/favorites` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PUT /api/v1/platform-records/users/:userId/homework-progress/:homeworkId` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PUT /api/v1/platform-records/users/:userId/lesson-notes/:pairSpaceId` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PUT /api/v1/platform-records/users/:userId/preferences` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-records/users/:userId` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/platform-records/users` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/analytics/onboarding-observation` | JwtAuthGuard, RolesGuard | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 200 | 403 | 403 |
| `GET /api/v1/analytics/report` | JwtAuthGuard, RolesGuard | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 200 | 403 | 403 |
| `POST /api/v1/requests/assignments` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/requests/assignments` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/requests/candidates` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/requests/:id/commands` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PUT /api/v1/requests/routes` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/requests/context` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/requests` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/requests/students/:studentId/debts` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/requests/dispatch/lessons` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/requests/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/requests` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/requests/report` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `DELETE /api/v1/requests/assignments/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/requests/routes` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/requests/students` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `POST /api/v1/schedule` | JwtAuthGuard, RolesGuard | 403 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 403 |
| `DELETE /api/v1/schedule/:id` | JwtAuthGuard, RolesGuard | 403 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 403 |
| `GET /api/v1/schedule` | JwtAuthGuard, RolesGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/schedule/range` | JwtAuthGuard, RolesGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/schedule/lessons/:id` | JwtAuthGuard, RolesGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/schedule/my` | JwtAuthGuard, RolesGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/schedule/changes` | JwtAuthGuard, RolesGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/schedule/lessons/:id/changes` | JwtAuthGuard, RolesGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PATCH /api/v1/schedule/:id` | JwtAuthGuard, RolesGuard | 403 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 403 |
| `GET /api/v1/search` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/academic/identities/moodle/:studentId` | JwtAuthGuard, RolesGuard | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 200 | 403 | 403 |
| `POST /api/v1/academic/identities/moodle/:studentId` | JwtAuthGuard, RolesGuard | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 200 | 403 | 403 |
| `GET /api/v1/academic/semester` | JwtAuthGuard, RolesGuard | 200 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 |
| `GET /api/v1/academic/semester/periods` | JwtAuthGuard, RolesGuard | 200 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 |
| `DELETE /api/v1/academic/identities/moodle/:studentId` | JwtAuthGuard, RolesGuard | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 200 | 403 | 403 |
| `POST /api/v1/superadmin/universities` | JwtAuthGuard, RolesGuard | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 200 | 403 |
| `DELETE /api/v1/superadmin/universities/:id` | JwtAuthGuard, RolesGuard | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 200 | 403 |
| `GET /api/v1/superadmin/connectors` | JwtAuthGuard, RolesGuard | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 200 | 403 |
| `GET /api/v1/superadmin/universities` | JwtAuthGuard, RolesGuard | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 200 | 403 |
| `PATCH /api/v1/superadmin/connectors/:id` | JwtAuthGuard, RolesGuard | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 200 | 403 |
| `PATCH /api/v1/superadmin/universities/:id` | JwtAuthGuard, RolesGuard | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 403 | 200 | 403 |
| `POST /api/v1/users/me/bind-group` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `DELETE /api/v1/users/me` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/users/me/deletion-preview` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/users/me/export` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/users/:id` | JwtAuthGuard | 200 | 403 | 403 | 403 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `GET /api/v1/users/me` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| `PATCH /api/v1/users/me` | JwtAuthGuard | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |

## Объявления без JwtAuthGuard

Это inventory, а не автоматическое подтверждение безопасности публичного API: webhook secrets и бизнес-проверки находятся в контроллерах/сервисах.

| Маршрут | Источник |
| --- | --- |
| `GET /api/v1/app` | [apps/backend/src/app.controller.ts](../../apps/backend/src/app.controller.ts) |
| `GET /api/v1/auth/rasp-catalog` | [apps/backend/src/auth/auth.controller.ts](../../apps/backend/src/auth/auth.controller.ts) |
| `GET /api/v1/auth/rasp-groups` | [apps/backend/src/auth/auth.controller.ts](../../apps/backend/src/auth/auth.controller.ts) |
| `GET /api/v1/auth/rasp-schedule` | [apps/backend/src/auth/auth.controller.ts](../../apps/backend/src/auth/auth.controller.ts) |
| `GET /api/v1/auth/rasp-years` | [apps/backend/src/auth/auth.controller.ts](../../apps/backend/src/auth/auth.controller.ts) |
| `GET /api/v1/auth/universities` | [apps/backend/src/auth/auth.controller.ts](../../apps/backend/src/auth/auth.controller.ts) |
| `POST /api/v1/auth/login` | [apps/backend/src/auth/auth.controller.ts](../../apps/backend/src/auth/auth.controller.ts) |
| `POST /api/v1/auth/max` | [apps/backend/src/auth/auth.controller.ts](../../apps/backend/src/auth/auth.controller.ts) |
| `POST /api/v1/auth/portal-login` | [apps/backend/src/auth/auth.controller.ts](../../apps/backend/src/auth/auth.controller.ts) |
| `POST /api/v1/auth/refresh` | [apps/backend/src/auth/auth.controller.ts](../../apps/backend/src/auth/auth.controller.ts) |
| `POST /api/v1/auth/register` | [apps/backend/src/auth/auth.controller.ts](../../apps/backend/src/auth/auth.controller.ts) |
| `GET /api/v1/career/accounts/portfolio/:studentId` | [apps/backend/src/career/career.controller.ts](../../apps/backend/src/career/career.controller.ts) |
| `GET /api/v1/career/accounts/portfolio/:studentId/cases` | [apps/backend/src/career/career.controller.ts](../../apps/backend/src/career/career.controller.ts) |
| `POST /api/v1/career/accounts/register` | [apps/backend/src/career/career.controller.ts](../../apps/backend/src/career/career.controller.ts) |
| `GET /api/v1/health` | [apps/backend/src/health.controller.ts](../../apps/backend/src/health.controller.ts) |
| `POST /api/v1/career/payments/notification` | [apps/backend/src/career-billing/payment.controller.ts](../../apps/backend/src/career-billing/payment.controller.ts) |
| `GET /api/v1/platform/public-settings` | [apps/backend/src/platform/platform.controller.ts](../../apps/backend/src/platform/platform.controller.ts) |
| `POST /api/v1/integrations/telegram/webhook` | [apps/backend/src/auth/telegram-webhook.controller.ts](../../apps/backend/src/auth/telegram-webhook.controller.ts) |

## CI и границы проверки

Job Backend E2E создаёт отдельные disposable базы curation/platform/tenant и runtime-роль NOSUPERUSER NOBYPASSRLS. CURATION_TEST_DATABASE_URL, PLATFORM_TEST_DATABASE_URL и TENANT_TEST_DATABASE_URL включают реальные HTTP/БД suites; TENANT_RLS_TEST_ADMIN_URL используется только для создания и удаления изолированных RLS fixtures. Тест транспорта host agent требует PLATFORM_AGENT_SOCKET. Проверка guards не заменяет эти проверки ресурсов и RLS.

Старые датированные UX-отчёты с восемью ролями описывают историческую проверку; они не являются актуальной матрицей ACL. [Обзор ролей](../architecture/roles-and-permissions.md).

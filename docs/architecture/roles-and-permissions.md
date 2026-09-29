# Роли и границы доступа

Коды ролей совпадают с `UserRole` в `apps/backend/src/auth/interfaces/user-role.ts`. Этот документ описывает смысл ролей; конкретное разрешение API задают controller decorators, guards и проверки сервисов.

## Роли

| Код | Название продукта | Назначение |
|---|---|---|
| `student` | Студент | Собственная группа, расписание, Pair Space, посещаемость и личные настройки |
| `teacher` | Преподаватель | Назначенные занятия и учебные действия в пределах backend resource checks |
| `curator` | Куратор | Назначенные группы и операции сопровождения/посещаемости |
| `faculty_dean` | Декан факультета | Действия в разрешённой области факультета, если конкретный endpoint их поддерживает |
| `department_head` | Заведующий кафедрой | Действия в разрешённой области кафедры, если конкретный endpoint их поддерживает |
| `university_admin` | Администратор ВУЗа | University cabinet и endpoints управления своим вузом |
| `superadmin` | Суперадминистратор | Явно ограниченные platform administration endpoints |
| `developer` | Разработчик | Технический кабинет; наличие роли не даёт автоматически доступ к учебным данным |

В текущей entity/API у пользователя одно значение `role`. Клиентская навигация помогает открыть нужную поверхность, но не заменяет backend authorization.

## Клиентские поверхности

| Поверхность | Типичная роль | Доступ |
|---|---|---|
| Student workspace | `student` | Персональные данные и группа пользователя |
| Staff workspace | `teacher`, `curator` | Назначенные занятия/группы и разрешённые действия |
| University cabinet | `university_admin`, `faculty_dean`, `department_head` | Только функции, предоставленные отдельным endpoint и его проверками |
| Developer workspace | `developer` | Техническая документация и диагностика |

`superadmin` — административное разрешение, а не отдельная пользовательская поверхность.

## Где проверять разрешения

- Ролевой enum: `apps/backend/src/auth/interfaces/user-role.ts`.
- Route policy: `@Roles(...)` в соответствующем controller.
- Общие проверки: `apps/backend/src/common/guards/roles.guard.ts` и `university.guard.ts`.
- Ресурсные/tenant проверки: профильный service и соответствующие тесты.
- Сгенерированный API-контракт: `/api/v1/docs`.

PostgreSQL RLS policies отсутствуют. Tenant isolation выполняется приложением; проверяйте tenant + resource ownership в каждом новом endpoint. Не переносите матрицы из старых спецификаций как фактические ACL без сверки с текущим controller/service.

## Связанные документы

- [Auth module](../modules/auth.md)
- [Security threat model](../security/threat-model.md)
- [Project map](../ai/project-map.md)

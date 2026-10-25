# Module: Auth (Регистрация и авторизация)

## 1. Цель и границы

**Цель:** Общий вход для всех ролей, управление сессиями, JWT, ролевой доступ, публичные справочники для онбординга.

**Не делает:** Управление структурой вуза и создание учётных записей (admin), уведомления (notifications), расписание (schedule).

> Актуально по коду: самостоятельная регистрация отключена (`POST /auth/register` → 403), SMS/телефонного входа в бэкенде нет.

---

## 2. Сущности

| Сущность    | Описание                  | Ключевые поля                                                                                                                                                                      |
| ----------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User        | Пользователь              | id, email, password_hash, first_name, last_name, phone, avatar_url, **role** (одно значение enum), university_id, group_id, max_user_id, telegram_user_id, is_active, session_version, last_login_at |
| DeviceToken | Токен устройства для push | id, user_id, platform, token, device_name, is_active                                                                                                                               |
| AuditLog    | Лог действий              | id, user_id, action, entity, entity_id, old_values, new_values, ip, user_agent                                                                                                     |

Роли (`users.role`, enum, одна основная роль на пользователя): `student`, `employer`, `career_staff`, `career_admin`, `teacher`, `curator`, `faculty_dean`, `department_head`, `university_admin`, `superadmin`, `developer`. Назначение куратора и дополнительные обязанности существуют отдельно от основной роли; актуальный входной контроль приведён в [матрице 11 ролей](../security/role-matrix.md).

Таблица сущностей описывает внутреннее хранилище, не JSON ответа профиля. В User также есть `personalDataDeletedAt` для неизменяемой архивной записи. GET/PATCH профиля и привязка группы возвращают явную безопасную проекцию без passwordHash/sessionVersion/MAX/Telegram идентификаторов; аннотация `@Exclude` сама по себе не заменяет такую проекцию.

Подробнее: [architecture/data-model.md](../architecture/data-model.md).

---

## 3. API

| Endpoint                      | Метод  | Описание                                                                                                                |
| ----------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------- |
| `/api/v1/auth/login`          | POST   | Вход по email/паролю                                                                                                    |
| `/api/v1/auth/max`            | POST   | Войти в ранее привязанный аккаунт из MAX WebApp (валидация initData)                                                   |
| `/api/v1/auth/max/link`       | POST   | Привязать MAX к текущей авторизованной сессии                                                                            |
| `/api/v1/auth/max/status`     | GET    | Получить только признак привязки MAX текущего аккаунта (JWT)                                                             |
| `/api/v1/auth/telegram/link`  | POST   | Создать одноразовую ссылку привязки Telegram (JWT)                                                                       |
| `/api/v1/auth/telegram/status` | GET   | Проверить привязку Telegram и доступность серверной настройки уведомлений без раскрытия ID/секретов (JWT)                |
| `/api/v1/integrations/telegram/webhook` | POST | Webhook бота для погашения кода (секретный заголовок Telegram)                                                         |
| `/api/v1/auth/portal-login`   | POST   | Единый вход в кабинеты; возвращает `workspace`: `student` \| `staff` \| `admin` \| `developer` |
| `/api/v1/auth/register`       | POST   | **Всегда 403** — самостоятельная регистрация отключена (аккаунты создаёт университет)                                   |
| `/api/v1/auth/universities`   | GET    | Список активных вузов (публичный; сейчас отдаёт только пилотный СИБИТ)                                                  |
| `/api/v1/auth/rasp-groups`    | GET    | Группы с rasp.sano.ru (публичный, `year` опционально)                                                                   |
| `/api/v1/auth/rasp-years`     | GET    | Учебные годы с rasp.sano.ru (публичный)                                                                                 |
| `/api/v1/auth/rasp-schedule`  | GET    | Расписание группы с rasp.sano.ru (публичный, `groupId` обязателен)                                                      |
| `/api/v1/auth/rasp-catalog`   | GET    | Полный каталог СИБИТа с rasp.sano.ru (публичный)                                                                        |
| `/api/v1/auth/refresh`        | POST   | Обновление access token (тело: `refreshToken`)                                                                          |
| `/api/v1/auth/logout`         | POST   | Выход со всех устройств: повышает `sessionVersion`, инвалидируя выданные access/refresh JWT                             |
| `/api/v1/users/me`            | GET    | Текущий пользователь                                                                                                    |
| `/api/v1/users/me/export` | GET | JSON своих данных из единого снимка БД; секретные колонки и внешние копии исключены явно |
| `/api/v1/users/me/deletion-preview` | GET | Удаляемые/сохраняемые классы и необходимые передачи обязанностей |
| `/api/v1/users/me`            | PATCH  | Обновление профиля                                                                                                      |
| `/api/v1/users/me` | DELETE | Парольное подтверждение, очистка профиля и приватных наборов, сохранение учебного архива под кодом |
| `/api/v1/users/me/bind-group` | POST   | Привязка к группе                                                                                                       |

SMS/кодовых эндпоинтов (`request-code`, `verify-code`) **нет**.

Полный OpenAPI: [api/README.md](../api/README.md).

---

## 4. Права доступа

| Действие                         | Роль                         | Ограничение                                                                                                         |
| -------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Вход (login, max, portal-login)  | Любая                        | —                                                                                                                   |
| Регистрация                      | —                            | Отключена: `POST /auth/register` → 403; аккаунт создаёт `university_admin` / `superadmin` через `POST /admin/users` |
| Просмотр профиля                 | Любая                        | Только свой профиль (`/users/me`)                                                                                   |
| Назначение ролей                 | university_admin, superadmin | Иерархия ролей: можно назначить только роль нижнего уровня (`admin.service.canManageRole`)                          |
| Удаление аккаунта | Любая, с сохранением платформенной защиты | Только свой аккаунт; текущий пароль, expectedUserId и явное подтверждение сохранения учебного архива; передача обязанностей при blockers |
| Публичные rasp.\* / universities | Без аутентификации           | —                                                                                                                   |

Матрица прав: [architecture/roles-and-permissions.md](../architecture/roles-and-permissions.md).

---

## 5. UX / экраны

- S01. Splash / Загрузка — [ui/screens-student.md](../ui/screens-student.md)
- S02. Welcome (первый запуск)
- S03. Ввод телефона — **спека UI, бэкенд-эндпоинтов SMS-входа нет**
- S04. Ввод SMS-кода — **спека UI, не реализовано на API**
- S05. Согласие на ПДн
- S06. Выбор вуза (реальный источник — `GET /auth/universities`, rasp.\* справочники)
- S07. Выбор факультета → курса → группы
- S08. Профиль (имя + аватар)

**Критичные UX-требования:**

- Вход ≤ 10 секунд (email/пароль, MAX)
- Согласие на ПДн обязательно
- `portal-login` определяет, в какой кабинет (`workspace`) попадает пользователь

---

## 6. Бизнес-правила и edge-cases

1. **Одна роль на пользователя:** `users.role` — enum-колонка; `RolesGuard` сравнивает `requiredRoles.includes(user.role)` — комбинаций `teacher + curator` не бывает (`apps/backend/src/users/entities/user.entity.ts`, `apps/backend/src/common/guards/roles.guard.ts`).
2. **Создание и восстановление аккаунтов:** админ `POST /admin/users` создаёт запись (email, пароль ≥ 10 символов, имя, роль, опционально группа); `POST /admin/users/:id/reset-password` заменяет пароль только управляемого пользователя своего ВУЗа. В обоих случаях сервер хранит bcrypt-хеш, а интерфейс не сохраняет временный пароль после отправки. Приглашение/саморегистрация недоступны.
3. **Rate limiting:** глобальный `ThrottlerGuard` ограничивает запросы по IP значениями `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` (по умолчанию 100/60 сек); `/auth/login`, `/auth/portal-login`, `/auth/max` и `/auth/max/link` дополнительно ограничены 10 запросами за 60 сек. В production Express учитывает два прокси в текущем маршруте host Nginx → Docker Nginx → backend. SMS-лимитов (3/час, блокировка после 5) не существует вместе с SMS-входом.
4. **Токены и отзыв:** пара `accessToken` + `refreshToken` подписывается с `JWT_ACCESS_EXPIRATION` / `JWT_REFRESH_EXPIRATION` (`apps/backend/src/config/configuration.ts`), а также содержит текущий `sessionVersion` пользователя. `POST /auth/logout`, блокировка/разблокировка, смена роли и сброс пароля повышают версию: JWT, выданные до этого, перестают проходить и на refresh, и на защищённых маршрутах. Refresh принимает токен в теле `POST /auth/refresh` — отдельной refresh-стратегии/гарда в коде нет. Хранение на клиенте: Secure Storage (mobile) / куки или storage (web).
5. **Удаление аккаунта:** `DELETE /users/me` вызывает парольное подтверждение и транзакционную очистку через AccountErasureService. Старые access/refresh JWT отклоняются; неизменяемая запись с кодом, вузом/группой и учебной историей остаётся. Это псевдонимизация с перечисленными исключениями, не полное уничтожение всех копий. Перед операцией доступны self JSON export и preview; [контракт удаления](../privacy/account-deletion.md) описывает подтверждения, передачи обязанностей, rollback и границы проверки. Административная `deactivate()` остаётся отдельной блокировкой.
6. **Восстановление пароля:** эндпоинта нет (TODO).
7. **Вход через MAX:** `POST /auth/max` проверяет подпись `initData` токеном `MAX_BOT_TOKEN`; `users.maxUserId` (unique) хранит привязку. Без токена — ответ 503 `MAX_NOT_CONFIGURED`. В общей форме входа пользователь явно выбирает MAX либо университетские email/пароль. Уже привязанный MAX входит в свой аккаунт независимо от сохранённой локальной сессии сайта. Непривязанный MAX получает 401 `MAX_ACCOUNT_NOT_LINKED`; пользователь может войти по email/паролю и связать MAX позже в «Настройки → Подключения аккаунта». `GET /auth/max/status` возвращает только `{ linked: boolean }` для текущей JWT-сессии. `POST /auth/max/link` требует JWT и свежий MAX `initData`, связывает только текущего пользователя атомарно и не перезаписывает существующие связи. Свежесть `initData` ограничена `MAX_INIT_DATA_TTL_SECONDS` (по умолчанию 900 секунд / 15 минут).
8. **Привязка Telegram:** вошедший пользователь создаёт в `/connections` одноразовую ссылку через JWT. Её случайный 192-битный код хранится только как SHA-256, истекает через 10 минут и погашается атомарно один раз через приватный `/start` webhook с `X-Telegram-Bot-Api-Secret-Token`. `users.telegramUserId` уникален; код и Telegram ID не позволяют переназначить существующую связь. Пароль в Telegram не передаётся. Связь Telegram не подтверждает MAX-идентичность: MAX привязывается отдельно проверенным `initData` внутри MAX.
8. **Portal login:** `POST /auth/portal-login` → `{ ...auth, workspace }`; маппинг: `student` → student, `teacher`/`curator`/`faculty_dean`/`department_head` → staff, `university_admin`/`superadmin` → admin, `developer` → developer. Все роли используют общую форму входа; developer открывается под `/developer/` на основном домене.
9. **Публичные rasp.\* эндпоинты:** отдают данные rasp.sano.ru (кэш 15 мин, таймаут 15 сек) через `RaspScraperService` (`apps/backend/src/auth/rasp-scraper.service.ts`), экспортируемый из `apps/backend/src/rasp/rasp.module.ts`. `SibitUniversityBootstrapService` (`apps/backend/src/auth/sibit-university-bootstrap.service.ts`) при старте приложения создаёт/активирует пилотный вуз.

---

## 7. События и уведомления

Модуль не публикует событий на шину `EventBusService` (`apps/backend/src/events/event-bus.service.ts`): ни вход, ни выдача роли, ни деактивация событий не генерируют. Событие «назначение роли → push» в коде не реализовано.

---

## 8. Нефункциональные требования

| Требование  | Значение                                                 |
| ----------- | -------------------------------------------------------- |
| Latency     | p95 ≤ 200 мс                                             |
| Offline     | No general offline auth mode; a retained session token does not make authenticated API calls available offline |
| Rate limits | Глобально `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS`; auth endpoints — 10/60 сек на IP |

---

## 9. Критерии приёмки

- [x] Самостоятельная регистрация отключена: `POST /auth/register` всегда возвращает 403; аккаунт выдаётся админом (`POST /admin/users`) — чек-лист «студент регистрируется за ≤ 2 минуты» неприменим
- [x] `POST /auth/portal-login` возвращает `workspace` и редиректит в нужный кабинет
- [ ] После входа видны только данные своей группы (tenant + group scope)
- [ ] Преподаватель не видит чужие пары
- [ ] Куратор видит только свою группу
- [ ] Вход по email/паролю работает для всех выданных аккаунтов
- [x] MAX auth через initData работает (эндпоинт реализован и покрыт тестами; для прогона в MAX задайте `MAX_BOT_TOKEN`)
- [ ] Refresh token автоматически обновляет access token
- [x] Лимиты на `login`, `portal-login`, `max` — 10 запросов за 60 сек на IP

---

## 10. Зависимости

**Зависит от:** —
**Зависимость от:** notifications (для push при назначении роли), admin (для создания учёток и назначения ролей), rasp (справочники групп/лет/расписания)

---

## 11. Open questions / TODO

- [ ] Вход через Госуслуги (после MVP)
- [ ] Двухфакторная аутентификация (после MVP)
- [ ] Восстановление пароля по email (эндпоинта нет)

---

## 12. Новое в коде (не описано ранее)

- `POST /auth/portal-login` с полем `workspace` (`auth.service.portalLogin`).
- Публичные `rasp.*` эндпоинты + `apps/backend/src/rasp/rasp.module.ts` + `apps/backend/src/auth/sibit-university-bootstrap.service.ts` (автосоздание пилотного вуза).
- Слой разрешений: `apps/backend/src/common/authorization/permissions.ts` (`PERMISSIONS`, `ROLE_PERMISSIONS`, `hasPermission`) + `@RequiresPermission` / `PermissionsGuard` — применяется на всех `/academic` маршрутах; остальные контроллеры используют `@Roles` + `RolesGuard`.
- Изоляция тенанта: глобальный `apps/backend/src/common/tenant/tenant-context.module.ts` (`TenantContext.assertAccess`) и `apps/backend/src/common/guards/university.guard.ts`; `universityId` кладётся в JWT payload.
- Аудит: сущность `apps/backend/src/common/entities/audit-log.entity.ts`, чтение через `GET /admin/audit-log` (запись в коде пока не реализована).

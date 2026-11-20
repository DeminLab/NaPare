# Production Stability Audit — 2026-11-20

## Итог

Исправлена подтверждённая причина UUID-ошибок для `GET /schedule/lessons/:id` и Pair Space: legacy-ссылка `rasp-<externalLessonId>-<externalGroupId>` теперь разрешается только через импортированные `Group.externalId` и `Lesson.externalId` активного tenant. Дальше API использует локальный UUID, поэтому расписание, Pair Space и личная заметка обращаются к одной сохранённой записи. Некорректные и неизвестные ID завершаются 404 до запроса в UUID-колонку.

Также HTTP 4xx больше не записываются как ошибки со stack trace; чувствительный query string исключён из логов и поля `path`. Добавлена GET-only совместимость маршрута `/student/career`, усилена блокировка известных путей сканирования в Compose Nginx.

Production, staging, Docker runtime и production-логи в этой сессии недоступны. Приведённые в исходном запросе строки логов не сопровождались исходными stack trace, временными метками запросов или версией развернутого образа. Поэтому состояния live-сервисов и устранение production-ошибок не подтверждены.

## Результаты по проблемам

| Область | Статус | Наблюдение и результат |
| --- | --- | --- |
| UUID-ошибка в `GET /schedule/lessons/:id` | **FIXED** | До исправления контроллер напрямую передавал произвольный `id` в TypeORM `findOne`. Теперь внешний ID сопоставляется tenant-scoped resolver-ом только с импортированной группой и занятием; остальные не-UUID значения отклоняются до SQL. |
| Legacy ID группы `101` и `12131` | **PARTIAL** | Сохранён существующий путь расписания СИБИТ по числовому `groupId`; добавлена регрессия для `101`, путь `12131` уже проверяется существующим тестом. Фактический ответ production `/schedule/v2` не проверен. |
| `GET /api/v1/schedule/v2` | **BLOCKED** | В текущем исходном дереве маршрут `/schedule/v2` отсутствует. Контракт и код развернутой версии не предоставлены; добавлять предполагаемый endpoint или формат ответа было бы небезопасно для клиентов. |
| `rasp-*` для карточки занятия | **PARTIAL** | Старые ссылки на импортированные занятия разрешаются в канонический UUID; студент дополнительно проходит проверку собственной группы. Неимпортированная публичная запись не имеет локального Lesson UUID и остаётся только для чтения. |
| Pair Space и личные заметки по старой ссылке | **PARTIAL** | При наличии tenant-scoped импорта GET/создание Pair Space и чтение/сохранение заметок используют найденный UUID. Для неимпортированной записи возвращается 404 без создания искусственного пространства. Проверены unit-сценарии; БД и клиентский повторный вход не запускались. |
| Расхождение `lessons` / `lesson_occurrences`, повторный sync и дубликаты | **NOT REPRODUCED** | Импорт СИБИТ в текущем коде сохраняет занятие по внешнему ID и локальной группе, сохраняя UUID при обновлениях. Production-данные, повторный импорт в БД и пользовательские связи не проверялись; миграций в этой работе нет. |
| `relation "university"` / `relation "group"` | **BLOCKED** | В коде сущности используют фактические таблицы `universities` и `groups`. Ошибочный диагностический SQL и stack trace не предоставлены, реальную схему БД проверить нельзя. Таблицы не переименовывались. |
| Next.js Server Actions / deployment skew | **BLOCKED** | Portal объявляет Next.js `15.5.27` в package manifest; локальная сборка разрешила `15.5.28`. В конфигурации не найдено `deploymentId` или собственного обработчика version skew. Без production image/build ID и запроса из лога причину установить нельзя. |
| `viewport` metadata | **FIXED (source)** | В portal `viewport` вынесен в отдельный export `Viewport`; поиск в portal не выявил прежнего размещения в metadata. Адаптивность на устройстве не проверялась. |
| 401 / обновление сессии | **NOT REPRODUCED** | Число 12 из сообщения само по себе не доказывает некорректный отказ. Нужны обезличенные traces с исходом refresh и клиентом; все web/mobile клиенты и параллельное обновление токенов не проверялись в runtime. |
| `GET /student/career` | **PARTIAL** | В Compose Nginx добавлен 302 на `/career` только для GET; другие методы получают 405. Проверка браузером и production конфигурации недоступна. |
| `POST /` | **NOT REPRODUCED** | Автоматический redirect не добавлен: назначение запроса не подтверждено, а POST нельзя безопасно перенаправить без контракта. |
| Redis | **PARTIAL** | Compose задаёт Redis 7 с AOF persistence и healthcheck. `vm.overcommit_memory`, RAM, swap, reconnect и состояние Redis-хоста проверить нельзя; системные параметры не менялись. |
| Nginx scanner paths | **PARTIAL** | Compose gateway блокирует `.env`, `.git`, `.svn`, `.pgpass`, `.npmrc`, backup/SQL, `wp-*`, `phpinfo.php`, `terraform.tfstate`, `actuator/heapdump`, `server-status` до upstream. Конфиг не прошёл `nginx -t`, так как Docker Engine недоступен; отсутствие внешних секретов не проверено. |
| Логирование HTTP ошибок | **FIXED (source)** | Глобальный filter пишет ожидаемые 4xx как WARN без stack trace, неожиданные 5xx — ERROR со stack trace. Query string удалён из логируемого пути и JSON `path`; Sentry получает только статус и HTTP-метод. Correlation ID и структурированный формат между Nginx/backend/PostgreSQL остаются незавершёнными. |
| Docker / контейнеры | **BLOCKED** | Compose manifest содержит backend, PostgreSQL, Redis, Nginx и пять web-приложений; отдельного `max-miniapp` сервиса в production Compose нет. Статусы контейнеров, ресурсы и восстановление после restart не проверены. `docker compose config --quiet` остановился на незаданных обязательных `DB_MIGRATION_USERNAME`/`DB_MIGRATION_PASSWORD`. |
| Остальные модули платформы | **NOT REPRODUCED** | Полный route/browser/security/performance аудит всех web-приложений, Android WebView и MAX Mini App не выполнялся; дополнительных подтверждённых проблем из этого прохода не заявляется. |

## Изменённые файлы

- `apps/backend/src/common/identifiers/lesson-id.ts` — общий разбор UUID и legacy RASP ID.
- `apps/backend/src/common/identifiers/lesson-identifier.service.ts` — разрешение legacy ID через tenant-owned Group/Lesson.
- `apps/backend/src/common/identifiers/lesson-identifier.service.spec.ts` — проверки tenant scope, валидных, неизвестных и повреждённых ID.
- `apps/backend/src/schedule/schedule.module.ts`, `apps/backend/src/schedule/schedule.service.ts` — экспорт resolver, ранний отказ для malformed ID и поиск student group по внешнему ID.
- `apps/backend/src/schedule/schedule.service.spec.ts` — регрессии для группы `101`, группы `12131`, карточки legacy-занятия и запрета чужой группы.
- `apps/backend/src/pair-space/pair-space.module.ts`, `apps/backend/src/pair-space/pair-space.service.ts` — разрешение legacy-ссылки до чтения/создания Pair Space.
- `apps/backend/src/pair-space/pair-space.service.spec.ts` — повторное чтение личной заметки по старому ID.
- `apps/backend/src/common/filters/http-exception.filter.ts`, `apps/backend/src/common/filters/http-exception.filter.spec.ts` — уровни логирования и redaction query string.
- `infrastructure/nginx/nginx.conf` — список блокируемых probe paths и GET-only redirect `/student/career`.
- `docs/modules/schedule.md`, `docs/modules/pair-space.md`, `docs/ops/infrastructure.md` — контракт разрешения ID и поведение Nginx.

Незакоммиченные изменения, существовавшие до этой работы, сохранены. В затронутых файлах они смешаны с текущими изменениями; при откате нельзя восстанавливать файлы целиком без проверки diff.

## База данных и данные

Entity и существующие миграции не менялись. Новых миграций нет. Production/локальная БД не открывалась, записи не изменялись и резервная копия не создавалась. Сопоставление использует уже существующие `Group.externalId`, `Lesson.externalId`, `organizationId` и `groupId`; для уникального поиска занятия применяется составная область tenant + группа + внешний ID.

## Выполненные проверки

| Проверка | Результат |
| --- | --- |
| Целевые backend unit tests: schedule, Pair Space, lesson identifier, exception filter | **Passed:** 4 suites, 56 tests. |
| Полный backend unit suite | **Passed:** 57 suites, 573 tests. |
| Backend TypeScript `tsc --noEmit` | **Passed.** |
| ESLint всех backend `src` и `test` TypeScript файлов (без `--fix`) | **Passed.** |
| Backend production build | **Passed.** |
| Portal production build | **Failed at standalone trace copy:** компиляция, typecheck и генерация страниц завершились; Windows завершил сборку с `EPERM` при создании symlink в `.next/standalone`. |
| `docker compose -f docker-compose.prod.yml config --quiet` | **Blocked:** обязательные локальные DB migration env vars отсутствуют. Значения не выводились. |
| `nginx -t` через `nginx:1.27-alpine` | **Blocked:** Docker daemon pipe недоступен. |
| Integration/E2E/HTTP, PostgreSQL миграции и данные | **Не запускались:** нет настроенного изолированного DB test environment. |
| Browser, Android, MAX, staging, production smoke/log comparison | **Не запускались:** инструменты/доступ в этой сессии недоступны. |
| `git diff --check` | **Passed** после текущих правок. |

## Развёртывание и откат

Изменения только в рабочем дереве; deployment не выполнялся. Не запускайте их в production без подтверждённой копии БД, staging-проверки и проверки Nginx. До выпуска:

1. Сохранить текущий полный worktree diff и отдельно зафиксировать базовый SHA; не включать посторонние пользовательские правки в release commit.
2. На staging настроить секреты штатным способом вне командной строки и выполнить `docker compose -f docker-compose.prod.yml config --quiet`.
3. Проверить конфигурацию внутри образа: `docker compose -f docker-compose.prod.yml run --rm --no-deps nginx nginx -t`.
4. Выполнить целевые проверки и проверить маршрут `/schedule/lessons/:id`, Pair Space, личную заметку и tenant rejection на синтетических данных.
5. Перед deployment создать проверенную восстанавливаемую копию PostgreSQL; миграций в данном diff нет, но backend запускает ожидающие миграции при старте.
6. При выпуске использовать одобренный релизный SHA/образ; после запуска проверить health каждого сервиса, `/api/v1/health`, основные role routes и обезличенные новые логи.

Откат: вернуть предыдущий backend/Nginx image set и перезапустить только затронутые сервисы по текущему release runbook; эта работа не меняет схему БД. Не использовать `docker compose down -v` и не выполнять массовую очистку Docker. Поскольку рабочее дерево уже содержало чужие незакоммиченные изменения, локальный откат должен отменять только перечисленные выше hunks, а не `git restore` всего файла.

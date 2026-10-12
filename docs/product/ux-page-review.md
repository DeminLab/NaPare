# Постраничная проверка интерфейса NaPare

Дата проверки: 11–12 октября 2026 года. Статус: **локальная проверка завершена с перечисленными ограничениями**.

## Среда и материалы

Отдельный Docker Compose project `napare-ux`: PostgreSQL `napare_ux`, Redis, NestJS backend, пять production-фронтендов и Nginx. Все девять контейнеров запущены; сайт и `/api/v1/health` отвечают HTTP 200. Изменения Docker/Nginx-конфигурации репозитория не вносились.

- [Работающий сайт](http://localhost:18080/).
- [Галерея всех страниц — компьютер/телефон, до/после](http://localhost:18080/ux-fixtures/ui-review/index.html).
- 51 исходный маршрут: портал 3, студент 14, сотрудник 13, ВУЗ 13, разработчик 8. Дополнительно сняты 10 ролевых вариантов.
- Созданы 10 тестовых аккаунтов: восемь ролей и вторые студент/преподаватель для проверки границ доступа. Вход всех ролей проверен; пароли и окружение находятся вне репозитория и галереи.
- Скриншоты и сведения о тестовом стенде находятся в `C:/Users/home/.codex/local-runs/napare-ux-2026-10-11/`. Они не включены в Git.

«До» в галерее означает первый Docker-обход после начального упрощения оболочки, а не состояние проекта до всей этой работы. Содержимое снимков различается с датой и сохранёнными тестовыми действиями. Перенаправления учитываются отдельно от самостоятельных экранов.

## Пользовательский результат

Основные разделы видны сразу, дополнительные доступны через «Ещё». Поиск открывает конкретное занятие, подготовку или материал; одинаковые предметы различаются по дате и времени. Общая помощь доступна в каждом кабинете, приветствие не повторяется на всех страницах. Сохранены ролевые акценты, адаптивные таблицы, заметные состояния ошибок и доступные действия.

## Реестр маршрутов

`CHECKED` — страница просмотрена в браузере и снята на 1440 и 390 px; это не означает проверку всех мутаций на ней. `REDIRECT` — проверен переход в существующий экран. `EXTERNAL DATA UNAVAILABLE` — экран/ошибка проверены, но данные внешнего источника не получены.

| Приложение | Маршрут | Результат | Снимки | Изменение / проверка |
| --- | --- | --- | --- | --- |
| web-portal | `/connections` | CHECKED | [Компьютер](http://localhost:18080/ux-fixtures/ui-review/public-connections-student-after-desktop.jpg) / [Телефон](http://localhost:18080/ux-fixtures/ui-review/public-connections-student-after-mobile.jpg) | Оформлены MAX/Telegram, проверка статуса и понятные шаги подключения; внешняя доставка не подтверждена. |
| web-portal | `/login` | CHECKED | [Компьютер](http://localhost:18080/ux-fixtures/ui-review/public-login-after-desktop.jpg) / [Телефон](http://localhost:18080/ux-fixtures/ui-review/public-login-after-mobile.jpg) | Единый вход email/password, понятные ошибки и MAX как дополнительный способ. |
| web-portal | `/` | CHECKED | [Компьютер](http://localhost:18080/ux-fixtures/ui-review/public-home-after-desktop.jpg) / [Телефон](http://localhost:18080/ux-fixtures/ui-review/public-home-after-mobile.jpg) | Уточнены задачи ролей и реальные возможности продукта. |
| web-student | `/student/login` | REDIRECT | [Компьютер](http://localhost:18080/ux-fixtures/ui-review/student-login-after-desktop.jpg) / [Телефон](http://localhost:18080/ux-fixtures/ui-review/student-login-after-mobile.jpg) | Перенаправление в общий вход или основной экран кабинета; самостоятельного нового экрана нет. |
| web-student | `/student/register` | REDIRECT | [Компьютер](http://localhost:18080/ux-fixtures/ui-review/student-register-after-desktop.jpg) / [Телефон](http://localhost:18080/ux-fixtures/ui-review/student-register-after-mobile.jpg) | Перенаправление в общий вход или основной экран кабинета; самостоятельного нового экрана нет. |
| web-student | `/student/absences` | CHECKED | [Компьютер](http://localhost:18080/ux-fixtures/ui-review/student-absences-after-desktop.jpg) / [Телефон](http://localhost:18080/ux-fixtures/ui-review/student-absences-after-mobile.jpg) | Форма и история доступны; API-создание/решение куратора проверены, нативный ввод дат через автоматизацию не подтверждён. |
| web-student | `/student/attendance/check-in` | CHECKED | [Компьютер](http://localhost:18080/ux-fixtures/ui-review/student-qr-after-desktop.jpg) / [Телефон](http://localhost:18080/ux-fixtures/ui-review/student-qr-after-mobile.jpg) | QR-ссылка приводит к отметке присутствия; камера/MAX не проверены. |
| web-student | `/student/groups` | EXTERNAL DATA UNAVAILABLE | [Компьютер](http://localhost:18080/ux-fixtures/ui-review/student-favorites-after-desktop.jpg) / [Телефон](http://localhost:18080/ux-fixtures/ui-review/student-favorites-after-mobile.jpg) | UI проверен; внешний каталог rasp.sano.ru не загрузился. Показаны ошибка и повтор, данные источника не подтверждены. |
| web-student | `/student/month` | CHECKED | [Компьютер](http://localhost:18080/ux-fixtures/ui-review/student-month-after-desktop.jpg) / [Телефон](http://localhost:18080/ux-fixtures/ui-review/student-month-after-mobile.jpg) | Общая навигация, восстановление даты/фильтров и переход к занятию. |
| web-student | `/student/notifications` | CHECKED | [Компьютер](http://localhost:18080/ux-fixtures/ui-review/student-notifications-after-desktop.jpg) / [Телефон](http://localhost:18080/ux-fixtures/ui-review/student-notifications-after-mobile.jpg) | Читаемые длинные сообщения; устранена мобильная горизонтальная прокрутка. |
| web-student | `/student/pair-space` | CHECKED | [Компьютер](http://localhost:18080/ux-fixtures/ui-review/student-preparation-after-desktop.jpg) / [Телефон](http://localhost:18080/ux-fixtures/ui-review/student-preparation-after-mobile.jpg) | Точные переходы к подготовке выбранной пары и статусы личного прогресса. |
| web-student | `/student/pair-space/a1000000-0000-4000-8000-000000000100` | CHECKED | [Компьютер](http://localhost:18080/ux-fixtures/ui-review/student-lesson-after-desktop.jpg) / [Телефон](http://localhost:18080/ux-fixtures/ui-review/student-lesson-after-mobile.jpg) | Четыре основных раздела, заметки/история отдельно, публикации доступны студенту. |
| web-student | `/student/profile` | CHECKED | [Компьютер](http://localhost:18080/ux-fixtures/ui-review/student-profile-after-desktop.jpg) / [Телефон](http://localhost:18080/ux-fixtures/ui-review/student-profile-after-mobile.jpg) | Фактическая группа, без UUID вместо названия университета, общая страница подключений. |
| web-student | `/student/settings` | CHECKED | [Компьютер](http://localhost:18080/ux-fixtures/ui-review/student-settings-after-desktop.jpg) / [Телефон](http://localhost:18080/ux-fixtures/ui-review/student-settings-after-mobile.jpg) | Общая навигация и помощь; настройки аккаунта сохранены в существующем интерфейсе. |
| web-student | `/student/today` | CHECKED | [Компьютер](http://localhost:18080/ux-fixtures/ui-review/student-today-after-desktop.jpg) / [Телефон](http://localhost:18080/ux-fixtures/ui-review/student-today-after-mobile.jpg) | Быстрые действия, ближайшее занятие/завершённый день, переход к следующему дню и подготовке. |
| web-student | `/student/week` | CHECKED | [Компьютер](http://localhost:18080/ux-fixtures/ui-review/student-week-after-desktop.jpg) / [Телефон](http://localhost:18080/ux-fixtures/ui-review/student-week-after-mobile.jpg) | Дата/режим/фильтры в URL; последний день включён; режим дня показывает выбранную дату. |
| web-student | `/student` | REDIRECT | [Компьютер](http://localhost:18080/ux-fixtures/ui-review/student-root-after-desktop.jpg) / [Телефон](http://localhost:18080/ux-fixtures/ui-review/student-root-after-mobile.jpg) | Перенаправление в общий вход или основной экран кабинета; самостоятельного нового экрана нет. |
| web-staff | `/staff/login` | REDIRECT | [Компьютер](http://localhost:18080/ux-fixtures/ui-review/staff-login-after-desktop.jpg) / [Телефон](http://localhost:18080/ux-fixtures/ui-review/staff-login-after-mobile.jpg) | Перенаправление в общий вход или основной экран кабинета; самостоятельного нового экрана нет. |
| web-staff | `/staff/assignments` | CHECKED | [Компьютер](http://localhost:18080/ux-fixtures/ui-review/staff-preparation-after-desktop.jpg) / [Телефон](http://localhost:18080/ux-fixtures/ui-review/staff-preparation-after-mobile.jpg) | Подготовка и сроки из реальных данных; сохранение срока больше не завершается 500. |
| web-staff | `/staff/attendance` | CHECKED | [Компьютер](http://localhost:18080/ux-fixtures/ui-review/staff-attendance-after-desktop.jpg) / [Телефон](http://localhost:18080/ux-fixtures/ui-review/staff-attendance-after-mobile.jpg) | Сохраняются только явно выбранные отметки; второй студент остаётся «Не отмечен». QR-сессия проверена. |
| web-staff | `/staff/groups` | CHECKED | [Компьютер](http://localhost:18080/ux-fixtures/ui-review/staff-groups-after-desktop.jpg) / [Телефон](http://localhost:18080/ux-fixtures/ui-review/staff-groups-after-mobile.jpg) | Использован существующий разрешённый endpoint; нет 403 и вложенных интерактивных элементов. |
| web-staff | `/staff/inbox` | CHECKED | [Компьютер](http://localhost:18080/ux-fixtures/ui-review/staff-inbox-after-desktop.jpg) / [Телефон](http://localhost:18080/ux-fixtures/ui-review/staff-inbox-after-mobile.jpg) | Состояния в URL, сохранение complete и просмотр «Разобраны»; действие не заменяет решение по обращению. |
| web-staff | `/staff/notifications` | CHECKED | [Компьютер](http://localhost:18080/ux-fixtures/ui-review/staff-notifications-after-desktop.jpg) / [Телефон](http://localhost:18080/ux-fixtures/ui-review/staff-notifications-after-mobile.jpg) | Общая навигация, поиск по разделам, помощь и мобильный доступ. Существующая структура страницы сохранена. |
| web-staff | `/staff/pair-space` | CHECKED | [Компьютер](http://localhost:18080/ux-fixtures/ui-review/staff-pair-list-after-desktop.jpg) / [Телефон](http://localhost:18080/ux-fixtures/ui-review/staff-pair-list-after-mobile.jpg) | Общая навигация и понятный переход к выбору занятия в расписании. |
| web-staff | `/staff/pair-space/a1000000-0000-4000-8000-000000000100` | CHECKED | [Компьютер](http://localhost:18080/ux-fixtures/ui-review/staff-lesson-after-desktop.jpg) / [Телефон](http://localhost:18080/ux-fixtures/ui-review/staff-lesson-after-mobile.jpg) | Одна панель публикаций, реальные объявления на главной вкладке, правдивое добавление ссылки на файл. |
| web-staff | `/staff/profile` | CHECKED | [Компьютер](http://localhost:18080/ux-fixtures/ui-review/staff-profile-after-desktop.jpg) / [Телефон](http://localhost:18080/ux-fixtures/ui-review/staff-profile-after-mobile.jpg) | Показана действительная роль и доступные группы; технические UUID убраны из основной информации. |
| web-staff | `/staff/settings` | CHECKED | [Компьютер](http://localhost:18080/ux-fixtures/ui-review/staff-settings-after-desktop.jpg) / [Телефон](http://localhost:18080/ux-fixtures/ui-review/staff-settings-after-mobile.jpg) | Категории GET/PATCH, явное сохранение и результат после перезагрузки; неподключённый Telegram обозначен. |
| web-staff | `/staff/today` | CHECKED | [Компьютер](http://localhost:18080/ux-fixtures/ui-review/teacher-today-after-desktop.jpg) / [Телефон](http://localhost:18080/ux-fixtures/ui-review/teacher-today-after-mobile.jpg) | Рабочий день больше не читает преподавателя как студента; корректно различает завершённые занятия и их отсутствие. |
| web-staff | `/staff/week` | CHECKED | [Компьютер](http://localhost:18080/ux-fixtures/ui-review/staff-week-after-desktop.jpg) / [Телефон](http://localhost:18080/ux-fixtures/ui-review/staff-week-after-mobile.jpg) | Общая навигация/помощь, исправленная граница диапазона расписания. |
| web-staff | `/staff` | REDIRECT | [Компьютер](http://localhost:18080/ux-fixtures/ui-review/staff-root-after-desktop.jpg) / [Телефон](http://localhost:18080/ux-fixtures/ui-review/staff-root-after-mobile.jpg) | Перенаправление в общий вход или основной экран кабинета; самостоятельного нового экрана нет. |
| web-admin | `/deanery/absences` | CHECKED | [Компьютер](http://localhost:18080/ux-fixtures/ui-review/admin-absences-after-desktop.jpg) / [Телефон](http://localhost:18080/ux-fixtures/ui-review/admin-absences-after-mobile.jpg) | Очередь загружается, подтверждение тестового обращения сохранено через UI. |
| web-admin | `/deanery/audit-log` | CHECKED | [Компьютер](http://localhost:18080/ux-fixtures/ui-review/admin-audit-after-desktop.jpg) / [Телефон](http://localhost:18080/ux-fixtures/ui-review/admin-audit-after-mobile.jpg) | Общая навигация, поиск по разделам, помощь и мобильный доступ. Существующая структура страницы сохранена. |
| web-admin | `/deanery/connectors` | CHECKED | [Компьютер](http://localhost:18080/ux-fixtures/ui-review/admin-connectors-after-desktop.jpg) / [Телефон](http://localhost:18080/ux-fixtures/ui-review/admin-connectors-after-mobile.jpg) | Понятное название «Источники данных», правдивые состояния незаданных интеграций. |
| web-admin | `/deanery/dashboard` | CHECKED | [Компьютер](http://localhost:18080/ux-fixtures/ui-review/admin-dashboard-after-desktop.jpg) / [Телефон](http://localhost:18080/ux-fixtures/ui-review/admin-dashboard-after-mobile.jpg) | Реальные показатели, отсутствие источника отличается от нуля; очередь отсутствий доступна. |
| web-admin | `/deanery/faculties` | CHECKED | [Компьютер](http://localhost:18080/ux-fixtures/ui-review/admin-faculties-after-desktop.jpg) / [Телефон](http://localhost:18080/ux-fixtures/ui-review/admin-faculties-after-mobile.jpg) | Общая навигация, поиск по разделам, помощь и мобильный доступ. Существующая структура страницы сохранена. |
| web-admin | `/deanery/groups` | CHECKED | [Компьютер](http://localhost:18080/ux-fixtures/ui-review/admin-groups-after-desktop.jpg) / [Телефон](http://localhost:18080/ux-fixtures/ui-review/admin-groups-after-mobile.jpg) | Общая навигация, поиск по разделам, помощь и мобильный доступ. Существующая структура страницы сохранена. |
| web-admin | `/deanery/notifications` | CHECKED | [Компьютер](http://localhost:18080/ux-fixtures/ui-review/admin-notifications-after-desktop.jpg) / [Телефон](http://localhost:18080/ux-fixtures/ui-review/admin-notifications-after-mobile.jpg) | Общая навигация, поиск по разделам, помощь и мобильный доступ. Существующая структура страницы сохранена. |
| web-admin | `/deanery/schedule-import` | CHECKED | [Компьютер](http://localhost:18080/ux-fixtures/ui-review/admin-schedule-after-desktop.jpg) / [Телефон](http://localhost:18080/ux-fixtures/ui-review/admin-schedule-after-mobile.jpg) | Общая навигация, поиск по разделам, помощь и мобильный доступ. Существующая структура страницы сохранена. |
| web-admin | `/deanery/structure` | CHECKED | [Компьютер](http://localhost:18080/ux-fixtures/ui-review/admin-structure-after-desktop.jpg) / [Телефон](http://localhost:18080/ux-fixtures/ui-review/admin-structure-after-mobile.jpg) | Общая навигация, поиск по разделам, помощь и мобильный доступ. Существующая структура страницы сохранена. |
| web-admin | `/deanery/university` | CHECKED | [Компьютер](http://localhost:18080/ux-fixtures/ui-review/admin-university-after-desktop.jpg) / [Телефон](http://localhost:18080/ux-fixtures/ui-review/admin-university-after-mobile.jpg) | Общая навигация, поиск по разделам, помощь и мобильный доступ. Существующая структура страницы сохранена. |
| web-admin | `/deanery/users` | CHECKED | [Компьютер](http://localhost:18080/ux-fixtures/ui-review/admin-users-after-desktop.jpg) / [Телефон](http://localhost:18080/ux-fixtures/ui-review/admin-users-after-mobile.jpg) | Общая навигация, поиск по разделам, помощь и мобильный доступ. Существующая структура страницы сохранена. |
| web-admin | `/deanery/login` | REDIRECT | [Компьютер](http://localhost:18080/ux-fixtures/ui-review/admin-login-after-desktop.jpg) / [Телефон](http://localhost:18080/ux-fixtures/ui-review/admin-login-after-mobile.jpg) | Перенаправление в общий вход или основной экран кабинета; самостоятельного нового экрана нет. |
| web-admin | `/deanery` | REDIRECT | [Компьютер](http://localhost:18080/ux-fixtures/ui-review/admin-root-after-desktop.jpg) / [Телефон](http://localhost:18080/ux-fixtures/ui-review/admin-root-after-mobile.jpg) | Перенаправление в общий вход или основной экран кабинета; самостоятельного нового экрана нет. |
| web-developer | `/developer/login` | REDIRECT | [Компьютер](http://localhost:18080/ux-fixtures/ui-review/developer-login-after-desktop.jpg) / [Телефон](http://localhost:18080/ux-fixtures/ui-review/developer-login-after-mobile.jpg) | Перенаправление в общий вход или основной экран кабинета; самостоятельного нового экрана нет. |
| web-developer | `/developer/api` | CHECKED | [Компьютер](http://localhost:18080/ux-fixtures/ui-review/developer-api-after-desktop.jpg) / [Телефон](http://localhost:18080/ux-fixtures/ui-review/developer-api-after-mobile.jpg) | Реальные проверки health/app/users, состояние проверки отличается от неисправности. |
| web-developer | `/developer/architecture` | CHECKED | [Компьютер](http://localhost:18080/ux-fixtures/ui-review/developer-architecture-after-desktop.jpg) / [Телефон](http://localhost:18080/ux-fixtures/ui-review/developer-architecture-after-mobile.jpg) | Маршруты приложений и текущий стек; внешние сервисы обозначены как зависимые от конфигурации. |
| web-developer | `/developer/docs` | CHECKED | [Компьютер](http://localhost:18080/ux-fixtures/ui-review/developer-docs-after-desktop.jpg) / [Телефон](http://localhost:18080/ux-fixtures/ui-review/developer-docs-after-mobile.jpg) | Адрес текущего стенда, действующие якоря, примеры и настоящий Swagger. |
| web-developer | `/developer/notifications` | CHECKED | [Компьютер](http://localhost:18080/ux-fixtures/ui-review/developer-events-after-desktop.jpg) / [Телефон](http://localhost:18080/ux-fixtures/ui-review/developer-events-after-mobile.jpg) | Личные уведомления отделены от событий платформы. |
| web-developer | `/developer/overview` | CHECKED | [Компьютер](http://localhost:18080/ux-fixtures/ui-review/developer-overview-after-desktop.jpg) / [Телефон](http://localhost:18080/ux-fixtures/ui-review/developer-overview-after-mobile.jpg) | Названия соответствуют содержимому, ссылка на поток событий ведёт к реальному разделу. |
| web-developer | `/developer/session` | CHECKED | [Компьютер](http://localhost:18080/ux-fixtures/ui-review/developer-session-after-desktop.jpg) / [Телефон](http://localhost:18080/ux-fixtures/ui-review/developer-session-after-mobile.jpg) | Сроки текущей сессии без отображения токена; понятные последствия выхода. |
| web-developer | `/developer` | REDIRECT | [Компьютер](http://localhost:18080/ux-fixtures/ui-review/developer-root-after-desktop.jpg) / [Телефон](http://localhost:18080/ux-fixtures/ui-review/developer-root-after-mobile.jpg) | Серверный цикл перенаправлений устранён. В IAB с прежним 308 проверен URL с параметром обновления кэша. |

## Проверенные сценарии

| Сценарий | Доказательство и граница |
| --- | --- |
| Авторизация | Настоящий portal-login и переходы в кабинеты восьми ролей; `/users/me` HTTP 200 у десяти тестовых аккаунтов |
| Объявление и материалы | Публикация через UI преподавателя, новое объявление видно студенту; ссылка на тестовый PDF открывается, файл отдаётся HTTP 200 |
| Подготовка со сроком | Через UI опубликована подготовка; отдельная проверка срока через API дала HTTP 201 и сохранённый ISO deadline. Регрессии покрывают date-only и ISO input |
| Личный прогресс и заметка | Изменены через UI студента и восстановлены после перезагрузки; пустая заметка отображается без ложной ошибки сети |
| Preferences | Изменение категории через UI преподавателя, PATCH и прежнее состояние после перезагрузки |
| Центр внимания | Пункт отмечен разобранным, найден в соответствующем состоянии |
| Посещаемость | Через UI сохранён один студент; после перезагрузки другой остаётся «Не отмечен» |
| QR | Преподаватель создал QR во временном окне тестового занятия, скопировал ссылку; второй студент открыл её и получил «Присутствие отмечено». Камера и нативный сканер MAX не проверены |
| Отсутствие | Подтверждение исходного тестового обращения через UI ВУЗа; отдельный API-путь: студент POST 201 → куратор PATCH 200 → студент GET 200 с сохранённым решением |
| Границы доступа | Второй преподаватель получает 403 при чтении чужой пары, владелец 200. Студент получает 403 на очередь staff. Изоляция одновременных запросов и университетов покрыта тестами |
| Расписание | Последний день date-only диапазона включён: первоначальные три занятия вернулись вместо пустого результата. ISO-границы и роль/университет сохранены |
| Навигация | Поиск → Enter → реальная пара; мобильное меню и фокус в диалоге; возвращение фильтров, ошибки/повторы и клавиатура также проверены в прежнем локальном UI-прогоне |

## Автоматические проверки

- Backend: 31 набор, **217 тестов**.
- Навигация: **9 тестов**; успешные пустые API-ответы: **4 теста**.
- TypeScript всех шести приложений, lint, boundary guard, AI documentation guard и проверка diff.
- Production Docker-сборки backend и всех пяти фронтендов выполнены в Linux; ранее отмеченное ограничение symlink на Windows не относится к этим успешным сборкам.
- Все 51 маршрута имеют сохранённые итоговые desktop/mobile снимки. Основные экраны дополнительно проверены на 360/768 px. Полного отдельного обхода всех страниц на 768 px не было.

## Дополнительные страницы

`/max/` проверен в браузере: сейчас это alias публичного портала, а не отдельное доказательство работы нативного MAX. `/api/v1/docs` открыл Swagger с действующей схемой. Снимки `max-alias-proof.jpg` и `swagger-proof.jpg` сохранены вместе с материалами проверки.

## Ограничения и следующий этап

- Внешний каталог СИБИТ в этой проверке не вернул учебные годы. Проверен готовый экран ошибки с повтором; каталог, добавление внешних групп в избранное и их живое расписание не подтверждены.
- Заполнение нативных полей даты через используемую автоматизацию не удалось подтвердить. API-создание отсутствия и публикация со сроком проверены отдельно; это не доказательство работы нативного date picker на всех устройствах.
- Производственные MAX/Telegram/Moodle, доставка сообщений, настоящие университетские данные, камеры телефонов и публичное развёртывание не проверены.
- Ранее опубликованные тексты старых уведомлений не переписывались; новый шаблон говорит о подготовке, а не о сдаче работы в НаПаре.
- Браузер IAB сохранил старое постоянное перенаправление `/developer/`. Прямой HTTP-переход исправлен и завершился 200 на `/developer/api`; браузерный результат снят через адрес с параметром обновления кэша. Старым закэшированным переходам может потребоваться очистка кэша.
- Пользовательский пилот пока не проведён: снижение времени поиска и количества ошибок не измерялось. План следующих функций описан в [UX-плане](ux-improvement-plan.md).

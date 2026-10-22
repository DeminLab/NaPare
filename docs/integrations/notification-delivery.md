# Доставка уведомлений: Redis, RuStore, WebPush, MAX и Telegram

Справочник реализации P1-1 от 22 октября 2026. Backend сохраняет уведомление и задания доставки в одной транзакции PostgreSQL; BullMQ выполняет отправку. Внешняя доставка по умолчанию выключена. Документ не подтверждает подключение production или получение уведомления реальным устройством.

## Выбор канала и запуск

1. Примените миграции обычной процедурой установки: миграция `1700000000034-NotificationDelivery` добавляет `device_tokens.provider`, таблицу `notification_deliveries` и обязательные FORCE RLS политики из миграции 29. Runtime-роль должна иметь `NOSUPERUSER NOBYPASSRLS`, включая локальные проверки.
2. Используйте отдельный Redis своей среды. Redis уже объявлен в dev Compose и GitHub CI; Compose не меняется. Для production оператору нужно настроить закрытую сеть, аутентификацию/TLS и persistence/AOF; открывать Redis в Интернет нельзя. Потеря Redis не теряет ещё не доставленный PostgreSQL outbox.
3. Сначала задайте `NOTIFICATIONS_QUEUE_ENABLED=true`, `REDIS_URL` и уникальный для среды `NOTIFICATIONS_QUEUE_PREFIX` (по умолчанию `napare`, буквы/цифры/`_`/`-`, до 80 символов). Реплики одной среды используют один prefix. `/api/v1/health` вернёт `queue=ok` после доступного PING; при ошибке Redis — HTTP 503 без адресов и секретов. При выключенной очереди — `queue=not_configured`.
4. Выберите `PUSH_PROVIDER=disabled|rustore|webpush|both`. Значение по умолчанию — `disabled`. RuStore предназначен для Android без обязательных Google Play Services; WebPush — для существующей PWA-подписки. Неподдерживаемое значение не включает провайдер.
5. Настройте выбранный провайдер в защищённом окружении. Только после проверки согласий, подключённых клиентов и тестовой среды включайте `NOTIFICATIONS_DELIVERY_ENABLED=true`. Без этого флага ни push, ни событийные сообщения MAX/Telegram не отправляются; ответ Telegram-бота при привязке также подавляется. Реальные отправки не входят в выполненные локальные тесты.

| Канал | Дополнительные переменные и условия |
| --- | --- |
| RuStore | `RUSTORE_PROJECT_ID`, `RUSTORE_SERVICE_TOKEN`; Android-клиент должен получить настоящий токен RuStore SDK и зарегистрировать его с `provider=rustore` |
| WebPush | `WEBPUSH_VAPID_SUBJECT`, `WEBPUSH_VAPID_PUBLIC_KEY`, `WEBPUSH_VAPID_PRIVATE_KEY`; существующая браузерная PushSubscription, публичный ключ должен совпадать с клиентским |
| Telegram | `TELEGRAM_NOTIFICATIONS_ENABLED=true`, существующий `TELEGRAM_BOT_TOKEN`; привязанный `telegramUserId` и сохранённое согласие `NotificationPreference.telegramEnabled=true` |
| MAX | `MAX_NOTIFICATIONS_ENABLED=true`, существующий `MAX_BOT_TOKEN`; активный пользователь с `maxUserId`. Включать после согласования правил уведомлений для пользователей MAX; новый интерфейс согласия в этом блоке не добавлялся |

Ключи нельзя включать в Git, диагностические ответы и журналы. `NOTIFICATIONS_DELIVERY_ENABLED=true` при выключенной очереди сохраняет `pending` для последующего запуска очереди; настройка сама по себе не запускает отправку.

Для кнопки перехода в MAX/Telegram используется существующий `PUBLIC_APP_URL` (`telegram.publicAppUrl` в конфигурации): только HTTPS, без credentials и с внутренним `deepLink` того же origin. При неправильном URL сообщение остаётся текстовым. Ограничения текста Telegram/MAX — 4096/4000 символов соответственно.

## Контракт регистрации

Существующий `POST /api/v1/devices/token` с JWT принимает `token`, `platform`, необязательные `deviceName` и новый `provider`. Допустимые провайдеры: `legacy` (по умолчанию для совместимости), `rustore`, `webpush`. Старые токены остаются сохранёнными, но `legacy` не отправляется автоматически через другой сервис.

Для WebPush `token` — сериализованный JSON PushSubscription с HTTPS `endpoint` и `keys.p256dh/auth`. Проверяются ключи, порт 443, отсутствие credentials и точное имя разрешённого хоста. По умолчанию разрешены `fcm.googleapis.com`, `updates.push.services.mozilla.com`, `web.push.apple.com`. `WEBPUSH_ALLOWED_HOSTS` заменяет список; добавлять можно только доверенные серверы push, поскольку подписка управляет адресом исходящего запроса. HTTP, loopback и похожие домены отклоняются при стандартном списке.

RuStore требует `platform=android` и непрозрачный токен допустимого формата. Максимум `token` — 8192 символа. Повторная регистрация своего токена обновляет устройство; захват токена другого пользователя запрещён. `DELETE /api/v1/devices/token` сохраняет прежний контракт и проверяет владельца. Токены не попадают в Redis job: там только `deliveryId` и `universityId`.

Этот блок реализует серверный контракт. Подключение SDK RuStore к APK, выдача разрешения браузером, создание PushSubscription и пользовательский обработчик `push` в PWA требуют отдельной клиентской проверки и не подтверждены серверными тестами.

## Состояния и гарантии

- `pending` — outbox зафиксирован в PostgreSQL и ожидает диспетчеризации; опрос каждые 10 секунд, до 100 строк за проход.
- `queued` / `sending` — BullMQ job и текущая попытка. Job ID равен delivery UUID; уникальный ключ БД — уведомление + канал + целевое устройство/пользователь.
- `delivered` — провайдер принял запрос; это не квитанция о прочтении или показе на устройстве.
- `suppressed` — канал или общий флаг были выключены, либо отправка отключена до выполнения. Такие строки терминальные и после включения флага сами не превращаются в рассылку старой истории.
- `dead` — постоянный отказ, истёкшие 24 часа, отозванный получатель или исчерпанные пять попыток. Сохраняются код ошибки, число попыток и до 20 последних переходов. Ответы провайдеров, токены и тексты исключений в историю не записываются.

Повторная обработка одного `eventId + userId` сериализуется PostgreSQL advisory lock и возвращает существующее уведомление. Запись уведомления откатывается, если невозможно записать outbox. Завершённое или терминальное задание не отправляется повторно при обычном дублировании job.

Доставка имеет семантику **at least once**. После принятия сообщения внешним сервисом и падения процесса до записи `delivered` повтор возможен: общего idempotency API у четырёх провайдеров нет. UUID включён в push payload/tag, чтобы клиент мог убрать дубликат. Нельзя обещать exactly once или автоматически повторять неизвестную внешнюю доставку как гарантированно новую.

Сетевые ошибки, HTTP 408/429/5xx повторяются с экспоненциальной задержкой 1, 2, 4, 8 секунд (всего пять попыток). Прочие HTTP 4xx терминальны. HTTP 404/410 для push деактивирует устройство; повторная регистрация может снова его включить. Telegram `ok:false` также считается ошибкой. Redirect запрещён для HTTP-провайдеров, timeout — пять секунд. Категории и тихие часы проверяются существующим `processEvent` до создания уведомления; отписка Telegram, деактивация пользователя и отзыв устройства перепроверяются перед отправкой.

Лимит попыток хранится в PostgreSQL и не сбрасывается, если Redis job пришлось создать заново после потери Redis. Это предотвращает шестую отправку, даже когда счётчик `attemptsMade` нового BullMQ job снова равен нулю.

BullMQ хранит до 1000 завершённых/ошибочных job, с лимитом времени 7/30 дней. PostgreSQL история не имеет автоматического удаления: срок хранения должен быть определён общей политикой данных. Readiness не доказывает правильность VAPID/бот-токенов/согласий.

## Изоляция и эксплуатация ошибок

Worker читает межвузовскую очередь только с capability на `notification_deliveries`, без payload и токенов. Затем выполняет каждый job в capability его единственного вуза; `replaceActor` исключает наследование случайного request actor. Новая таблица использует обязательные restrictive FORCE RLS политики. Пользователь API не получает глобальную capability.

При сбое Redis проверьте readiness, закрытый адрес, credentials, ACL и persistence. PostgreSQL `pending` останутся до восстановления. После восстановления опрос возобновится без ручного создания нового уведомления. Не запускайте `FLUSHALL`, `FLUSHDB` или массовое удаление outbox.

При росте `dead` оператор с разрешённым доступом к своей среде проверяет `channel`, `status`, `attempts`, `lastError` и историю в `notification_deliveries`, не копируя токены. Исправьте credentials/отозванную подписку и оцените актуальность сообщения. Автоматического сброса `dead` или публичного retry API нет: массовый сброс создаёт риск дубликатов. Для намеренной повторной рассылки создайте новое бизнес-событие после решения оператора. Platform Notifications по-прежнему служит для чтения/исправления in-app записей и отзыва устройств; исправление текста не означает повторную отправку.

## Проверки

```powershell
pnpm --filter @napare/backend exec jest --runInBand
pnpm --filter @napare/backend exec tsc --noEmit
pnpm test:e2e
```

E2E `notification-delivery.e2e-spec.ts` выполняется при `NOTIFICATION_TEST_DATABASE_URL` и `NOTIFICATION_TEST_REDIS_URL`. БД должна быть новой loopback `curation_test_*`, владелец — `NOSUPERUSER NOBYPASSRLS`. Redis должен быть тестовым; suite использует уникальный prefix `notification_test_*` и очищает только свои BullMQ keys. Без обеих переменных suite явно пропускается. CI создаёт отдельную БД и использует свой Redis service. Реальные внешние HTTP-запросы в suite запрещены; provider acceptance проверяется mock-ответами.

## Первоисточники

- [RuStore: отправка push и авторизация сервисным токеном](https://www.rustore.ru/help/sdk/push-notifications/send-push-notifications).
- [MAX: POST messages и ограничение скорости](https://dev.max.ru/docs-api/methods/POST/messages).
- [Telegram Bot API: sendMessage](https://core.telegram.org/bots/api#sendmessage).
- [Web Push library: VAPID, timeout и PushSubscription](https://github.com/web-push-libs/web-push).
- [BullMQ: retry/backoff](https://docs.bullmq.io/guide/retrying-failing-jobs).

Официальные форматы RuStore и MAX сверены 22 октября 2026. Реальные устройства, Telegram/MAX аккаунты и production не использовались.

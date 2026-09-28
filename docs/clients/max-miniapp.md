# Клиент: MAX Mini-App (React + Vite)

## Обзор

| Параметр | Значение |
|----------|----------|
| **Платформа** | Мессенджер MAX (внутри приложения) |
| **Стек** | React + Vite + TypeScript, MAX SDK |
| **Аудитория** | Студенты (быстрый доступ) |
| **Приоритет** | Высокий |

---

## Сценарии MVP

1. Быстрый просмотр «Мой день»
2. Расписание на сегодня
3. Открытие пространства конкретной пары
4. Установка / изменение статуса отсутствия
5. Просмотр горящих дедлайнов

Полноценный функционал (обсуждения, загрузка файлов) — в нативном приложении.

## Реализация MVP

`apps/max-miniapp` — готовая Vite-сборка, подключённая к реальному API НаПаре:

- **Авторизация**: при открытии в MAX клиент передаёт `window.WebApp.initData` в `POST /api/v1/auth/max`; в браузере (без Bridge) работает обычный вход по email/паролю. Токены хранятся в `localStorage`, при 401 клиент автоматически обновляет access-токен через `/auth/refresh`.
- **Реальные данные**: экран «Сегодня» — `GET /my-day`, «Расписание» — `GET /schedule/my` с переключением недель, «Пары» — `GET /pair-spaces/:lessonId` (объявления, задания, материалы), «Уведомления» — `GET /notifications`, профиль — `GET /users/me`, заявка об отсутствии — `POST /absences`.
- **MAX Bridge** используется только через `src/lib/max-bridge.ts` (launch data без прав авторизации).

Вся работа с API — в `src/lib/api.ts`, экраны — в `src/App.tsx`.

```bash
pnpm --filter @napare/max-miniapp dev     # http://localhost:3005, /api проксируется на localhost:3000
pnpm --filter @napare/max-miniapp build
pnpm --filter @napare/max-miniapp test
```

Docker Compose собирает static build в образе приложения; опубликованный на хосте порт контейнера — `127.0.0.1:3006`. Внутренний nginx проксирует `/api/` на `backend:3000` (сервис подключён к сети `app`).

В production мини-приложение доступно по адресу `https://napare.sano.ru/max/`. Публичный Nginx передаёт этот путь Docker Nginx, который убирает префикс `/max/` перед запросом к контейнеру Mini App; Vite при этом генерирует ссылки на ресурсы с тем же префиксом. API остаётся на общем адресе `/api/v1`.

Перед публикацией в MAX необходимо:

1. После обновления кода на production-сервере выполните `docker compose build max-miniapp`, `docker compose up -d max-miniapp` и `docker compose restart nginx`, затем проверьте `https://napare.sano.ru/max/` и загрузку JS/CSS ресурсов.
2. Вписать `MAX_BOT_TOKEN` (токен бота MAX, который хостит мини-приложение) в `.env` — без него `POST /api/v1/auth/max` отвечает 503.
3. Указать этот URL в настройках бота MAX и получить командный platform token.

---

## Структура проекта

```
apps/max-miniapp/
├── index.html              # подключает https://st.max.ru/js/max-web-app.js
├── nginx.conf              # статика + прокси /api/ на backend:3000
├── package.json
├── vite.config.ts          # dev-прокси /api → localhost:3000
├── src/
│   ├── main.tsx
│   ├── App.tsx             # auth-гейт, пять экранов, заявка об отсутствии
│   ├── styles.css
│   └── lib/
│       ├── max-bridge.ts   # обёртка над MAX Bridge (initData, ready, expand)
│       ├── api.ts          # API-клиент: токены, refresh, эндпоинты
│       ├── api.test.ts
│       └── max-bridge.test.ts
└── public/
```

---

## Подключение MAX Bridge

```html
<script src="https://st.max.ru/js/max-web-app.js"></script>
```

`src/lib/max-bridge.ts` экспортирует `initializeMax()` (ready + expand), `getMaxWebApp()` и `getInitData()` — сырые launch-данные, которые обязаны пройти серверную валидацию.

---

## Авторизация

Через `initData` MAX → `POST /api/v1/auth/max` → проверка подписи (HMAC, `MAX_BOT_TOKEN`) → JWT НаПаре.

Флоу:

1. **Открытие в MAX**: клиент отправляет `initData` в `POST /auth/max`. Если аккаунт уже привязан (`users.maxUserId`) — сразу выдаются токены.
2. **Первый вход**: сервер отвечает `401 MAX_ACCOUNT_NOT_LINKED`; клиент показывает форму email/пароль и повторяет запрос с креденшелами — аккаунт университета привязывается к MAX-идентификатору, после чего вход в MAX становится автоматическим.
3. **Браузер (без Bridge)**: обычная форма → `POST /auth/login`.

`initData` валидируется сервером (HMAC-SHA256 + `auth_date` не старше `MAX_INIT_DATA_TTL_SECONDS`, по умолчанию 1 час); клиент никогда не доверяет launch-данным как учётной записи.

---

## UX-особенности

- Минимальный chrome (нативная шапка MAX)
- Кнопка «Назад» через SDK
- Вертикальные свайпы — не перехватывать
- Быстрая загрузка (код-сплиттинг, минимальный бандл)
- Подстраиваться под тему MAX (светлая/тёмная)

---

## Критерии приёмки

- [x] Открывается в обычном браузере и инициализирует MAX Bridge при его наличии
- [x] Авторизация через initData работает — backend endpoint `POST /api/v1/auth/max` реализован и покрыт тестами
- [x] Показывает «Мой день» и расписание из реального API
- [x] Демонстрирует отправку заявки об отсутствии (реальный `POST /absences`)
- [ ] Корректно закрывается через Bridge — отдельный UX-сценарий при настройке бота
- [ ] Работает на слабом интернете — offline cache отложен

---

## См. также

- [clients/mobile.md](mobile.md) — нативное приложение
- [clients/web.md](web.md) — веб-приложение
- [modules/my-day.md](../modules/my-day.md) — логика «Мой день»

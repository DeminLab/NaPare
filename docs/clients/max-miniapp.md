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

`apps/max-miniapp` содержит готовую Vite-сборку: экран «Сегодня», переходы по пяти разделам, lesson space-заглушку и форму отсутствия для демонстрации user flow. Она корректно работает в обычном браузере и использует MAX Bridge только через `src/lib/max-bridge.ts`.

```bash
pnpm --filter @napare/max-miniapp dev
pnpm --filter @napare/max-miniapp build
pnpm --filter @napare/max-miniapp test
```

Docker Compose использует уже проверенный static build. Перед `docker compose up` выполните `pnpm --filter @napare/max-miniapp build`.

Перед публикацией в MAX необходимо:

1. Разместить static build на внешнем HTTPS URL.
2. Добавить backend endpoint, который валидирует `initData` и выдаёт JWT.
3. Указать этот URL в настройках бота MAX и получить командный platform token.

---

## Структура проекта

```
napare-max-miniapp/
├── index.html
├── package.json
├── vite.config.ts
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── max/
│   │   ├── sdk.ts          # обёртка над MAX Bridge
│   │   └── auth.ts         # работа с initData
│   ├── api/
│   │   └── client.ts
│   ├── pages/
│   │   ├── MyDay.tsx
│   │   ├── Schedule.tsx
│   │   ├── PairSpace.tsx
│   │   └── Absence.tsx
│   ├── components/
│   └── types/
└── public/
```

---

## Подключение MAX Bridge

```html
<script src="https://st.max.ru/js/max-web-app.js"></script>
```

```typescript
// src/max/sdk.ts
declare global {
  interface Window {
    Max?: {
      ready: () => Promise<void>;
      close: () => void;
      expand: () => void;
    };
  }
}

export async function initMax() {
  if (!window.Max) return null;
  await window.Max.ready();
  return window.Max;
}
```

---

## Авторизация

Через `initData` MAX → `POST /api/v1/auth/max` → проверка подписи → JWT НаПаре.

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
- [ ] Авторизация через initData работает — нужен backend validation endpoint
- [x] Показывает «Мой день» и расписание в demo flow
- [x] Демонстрирует отправку заявки об отсутствии
- [ ] Корректно закрывается через Bridge — отдельный UX-сценарий при настройке бота
- [ ] Работает на слабом интернете — offline cache отложен

---

## См. также

- [clients/mobile.md](mobile.md) — нативное приложение
- [clients/web.md](web.md) — веб-приложение
- [modules/my-day.md](../modules/my-day.md) — логика «Мой день»

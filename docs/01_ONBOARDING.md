# Онбординг: новый разработчик / AI-агент

**Цель:** начать вносить вклад в проект за ≤ 30 минут.

---

## Путь 15 минут (минимум)

| Шаг | Время | Что сделать |
|-----|-------|-------------|
| 1 | 2 мин | Прочитать [00_START_HERE.md](00_START_HERE.md) — общее понимание |
| 2 | 3 мин | Прочитать [02_GLOSSARY.md](02_GLOSSARY.md) — термины |
| 3 | 5 мин | Прочитать [architecture/system-overview.md](architecture/system-overview.md) — архитектура + Mermaid |
| 4 | 5 мин | Прочитать нужный `modules/*.md` — модуль для работы |

**Готово.** Можно брать задачу.

---

## Путь 30 минут (полный)

| Шаг | Время | Что сделать |
|-----|-------|-------------|
| 1 | 2 мин | [00_START_HERE.md](00_START_HERE.md) |
| 2 | 3 мин | [02_GLOSSARY.md](02_GLOSSARY.md) |
| 3 | 5 мин | [architecture/system-overview.md](architecture/system-overview.md) |
| 4 | 3 мин | [architecture/tech-stack.md](architecture/tech-stack.md) |
| 5 | 3 мин | [architecture/roles-and-permissions.md](architecture/roles-and-permissions.md) |
| 6 | 5 мин | [modules/*.md](modules/_TEMPLATE.md) — нужный модуль |
| 7 | 5 мин | [api/README.md](api/README.md) — как смотреть OpenAPI |
| 8 | 4 мин | [process/contributing.md](process/contributing.md) — PR-процесс |

---

## Поднять проект локально

```bash
# 1. Клонировать репозиторий
git clone https://github.com/napare/napare.git
cd napare

# 2. Поднять инфраструктуру
docker compose up -d

# 3. Backend
cd apps/backend
cp .env.example .env
pnpm install
pnpm run start:dev

# 4. Web
cd ../web
pnpm install
pnpm run dev

# 5. Mobile (эмулятор)
cd ../mobile
flutter pub get
flutter run

# 6. MAX Mini-App
cd ../max-miniapp
pnpm install
pnpm run dev
```

**Требования:** Node.js 20+, pnpm, Flutter 3.22+, Docker + Docker Compose.

---

## Первый task

Идеальный первый task для нового разработчика:

1. Найти в `modules/*.md` пункт **Open questions / TODO**
2. Выбрать один с низкой сложностью
3. Создать branch `feature/<описание>`
4. Реализовать + написать тесты
5. Обновить `modules/*.md` если изменилась логика
6. Отправить PR в `develop`

---

## Как работает AI-агент

1. Прочитать [01_ONBOARDING.md](01_ONBOARDING.md) (этот файл)
2. Определить модуль из задачи
3. Прочитать `modules/<модуль>.md` целиком
4. Следовать критериям приёмки из раздела 9 модуля
5. Проверить по чеклисту из [process/definition-of-done.md](process/definition-of-done.md)

---

## Полезные ссылки

| Ресурс | Где |
|--------|-----|
| OpenAPI (локально) | `http://localhost:3000/api/v1/docs` |
| OpenAPI (staging) | `https://staging.napare.ru/api/v1/docs` |
| Grafana | `https://grafana.napare.ru` |
| Sentry | `https://sentry.napare.ru` |
| GitHub | `https://github.com/napare/napare` |

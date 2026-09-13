# Deployment Guide

Пошаговое руководство по деплою на все среды.

---

## 1. Предварительные требования

### Инструменты

| Инструмент | Версия | Назначение |
|------------|--------|------------|
| Docker | 24+ | Контейнеризация |
| Docker Compose | v2 | Оркестрация локально |
| kubectl | 1.28+ | Управление K8s |
| helm | 3.14+ | Чарты для K8s |
| pnpm | 9+ | Пакетный менеджер |
| Node.js | 20+ | Backend, Web |
| Flutter | 3.19+ | Mobile |

### Доступы

| Ресурс | Где получить |
|--------|--------------|
| GitHub token | Settings → Developer settings → Personal access tokens |
| Docker Hub token | Account → Security → Access tokens |
| Yandex Cloud CLI | `yc init` |
| K8s kubeconfig | `yc managed-kubernetes get-credentials` |
| Database password | Password manager (1Password / Bitwarden) |

---

## 2. Local Development

```bash
# 1. Клонировать репозиторий
git clone https://github.com/napare/napare.git
cd napare

# 2. Установить зависимости
pnpm install

# 3. Настроить переменные окружения
cp .env.example .env
cp apps/backend/.env.example apps/backend/.env
cp apps/web/.env.local.example apps/web/.env.local

# 4. Запустить инфраструктуру
docker compose -f docker-compose.dev.yml up -d db redis minio

# 5. Выполнить миграции
cd apps/backend
pnpm db:generate
pnpm db:migrate
pnpm db:seed
cd ../..

# 6. Запустить все сервисы
pnpm dev
```

### Проверка

| Сервис | URL | Ожидаемый результат |
|--------|-----|---------------------|
| Backend | http://localhost:3000/api/v1/docs | Swagger UI |
| Web | http://localhost:3001 | Страница входа |
| PostgreSQL | localhost:5432 | Подключение |
| Redis | localhost:6379 | PONG |
| MinIO | http://localhost:9001 | Консоль MinIO |

---

## 3. Staging

### Автоматический деплой

Деплой происходит автоматически при пуше в ветку `develop`.

### Ручной деплой

```bash
# 1. Собрать Docker-образы
docker build -t napare-backend:staging -f apps/backend/Dockerfile .
docker build -t napare-web:staging -f apps/web/Dockerfile .

# 2. Запушить в Docker Hub
docker push napare-backend:staging
docker push napare-web:staging

# 3. Обновить в K8s
kubectl set image deployment/backend backend=napare-backend:staging -n staging
kubectl set image deployment/web web=napare-web:staging -n staging

# 4. Проверить статус
kubectl get pods -n staging
kubectl logs -f deployment/backend -n staging
```

### Проверка после деплоя

```bash
# Health check
curl https://staging.napare.ru/api/v1/health

# Логи
kubectl logs -f deployment/backend -n staging --tail=100

# Метрики
curl https://staging.napare.ru/api/v1/metrics
```

---

## 4. Production

### Преддеплой чек-лист

- [ ] Все тесты зелёные в staging
- [ ] Ревью изменений
- [ ] Backup базы данных
- [ ] Уведомление команды в Telegram
- [ ] Проверка load balancer
- [ ] Проверка SSL сертификатов

### Деплой

```bash
# 1. Собрать Docker-образы
docker build -t napare-backend:latest -f apps/backend/Dockerfile .
docker build -t napare-web:latest -f apps/web/Dockerfile .

# 2. Запушить в Docker Hub
docker push napare-backend:latest
docker push napare-web:latest

# 3. Обновить в K8s
kubectl set image deployment/backend backend=napare-backend:latest -n production
kubectl set image deployment/web web=napare-web:latest -n production

# 4. Миграции (если есть)
kubectl exec -it deployment/backend -n production -- pnpm db:migrate:prod

# 5. Проверить статус
kubectl get pods -n production
kubectl logs -f deployment/backend -n production
```

### Откат

```bash
# Откат на предыдущий образ
kubectl rollout undo deployment/backend -n production
kubectl rollout undo deployment/web -n production

# Проверка отката
kubectl rollout status deployment/backend -n production
```

---

## 5. Миграции базы данных

### Локально

```bash
cd apps/backend

# Создать миграцию
pnpm db:migrate -- --name add_notifications_table

# Применить миграции
pnpm db:migrate

# Откатить последнюю миграцию
pnpm db:migrate:undo
```

### В K8s

```bash
# Применить миграции в staging
kubectl exec -it deployment/backend -n staging -- pnpm db:migrate:prod

# Применить миграции в production
kubectl exec -it deployment/backend -n production -- pnpm db:migrate:prod
```

### Правила миграций

1. **Никогда** не удалять данные в продакшене
2. **Всегда** тестировать миграцию локально перед деплоем
3. **Всегда** иметь rollback-план
4. **Не** переименовывать колонки (создавать новую + мигрировать данные)
5. **Не** добавлять NOT NULL без дефолта

---

## 6. Mobile App Store / Google Play

### iOS (App Store)

```bash
# 1. Собрать релиз
cd apps/mobile
flutter build ios --release

# 2. Открыть в Xcode
open ios/Runner.xcworkspace

# 3. Настроить Signing & Capabilities
# - Team: Napare LLC
# - Bundle Identifier: ru.napare.mobile

# 4. Archive & Upload
# Product → Archive → Distribute App → App Store Connect
```

### Android (Google Play)

```bash
# 1. Собрать релиз
cd apps/mobile
flutter build appbundle --release

# 2. Результат
# build/app/outputs/bundle/release/app-release.aab

# 3. Загрузить в Google Play Console
# https://play.google.com/console
```

### Виджеты (после MVP)

- **iOS WidgetKit**: home screen виджет "Мой день"
- **Android App Widget**: виджет расписания

---

## 7. MAX Mini-App

### Публикация

```bash
# 1. Собрать
cd apps/max-miniapp
pnpm build

# 2. Загрузить в MAX Platform
# https://max.com/developers/apps
```

### URL для MAX

| Среда | URL |
|-------|-----|
| Dev | http://localhost:5173 |
| Staging | https://staging-miniapp.napare.ru |
| Production | https://miniapp.napare.ru |

---

## 8. Мониторинг после деплоя

### Первые 15 минут

```bash
# Логи ошибок
kubectl logs -f deployment/backend -n production | grep -i error

# Метрики CPU/Memory
kubectl top pods -n production

# Health check
curl -s https://napare.ru/api/v1/health | jq
```

### Первый час

- Проверить Sentry на новые ошибки
- Проверить PostHog на события
- Проверить Uptime Robot / Pingdom
- Проверить recent deployments в GitHub

### Первые сутки

- Проверить rate limits
- Проверить ошибки в Sentry
- Проверить метрики производительности
- Проверить feedback от пользователей

---

## 9. Troubleshooting

| Проблема | Решение |
|----------|---------|
| Pod в CrashLoopBackOff | `kubectl logs pod-name` — посмотреть ошибку |
| OOMKilled | Увеличить лимит памяти в deployment |
| Database connection refused | Проверить DATABASE_URL, PgBouncer |
| Redis connection refused | Проверить REDIS_URL, Redis Cluster |
| SSL cert expired | Обновить cert-manager / Let's Encrypt |
| Push не доставляется | Проверить FCM/APNs ключи, логи push-сервиса |
| API отвечает 502 | Проверить health check, restart pods |

---

## 10. См. также

- [ops/cicd.md](cicd.md) — CI/CD pipeline
- [ops/monitoring.md](monitoring.md) — мониторинг
- [ops/runbooks.md](runbooks.md) — runbook'и

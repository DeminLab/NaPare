# ADR-0007: Стратегия деплоя

## Статус
Принято

## Контекст
Нужна стратегия деплоя для:
- Локальной разработки
- Staging окружения (пилот СИБИТ)
- Production (после пилота)

## Решение

### Этап 1: Пилот (СИБИТ)
**Docker Compose на VPS**

```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  backend:
    image: napare/backend:latest
    environment:
      - DATABASE_URL=postgresql://...
      - JWT_SECRET=...
    ports:
      - "3000:3000"
  
  web:
    image: napare/web:latest
    ports:
      - "80:80"
  
  postgres:
    image: postgres:16
    volumes:
      - pgdata:/var/lib/postgresql/data
  
  redis:
    image: redis:7-alpine
```

### Этап 2: Масштабирование
**Kubernetes (K8s)**

```yaml
# k8s/backend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: napare-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: napare-backend
  template:
    spec:
      containers:
        - name: backend
          image: napare/backend:latest
          ports:
            - containerPort: 3000
```

## CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Lint
        run: pnpm lint
      
      - name: Test
        run: pnpm test
      
      - name: Build
        run: pnpm build
      
      - name: Build Docker images
        run: |
          docker build -t napare/backend:latest ./apps/backend
          docker build -t napare/web:latest ./apps/web
      
      - name: Deploy to server
        run: |
          ssh deploy@server "docker compose pull && docker compose up -d"
```

## Среды

| Среда | URL | Назначение |
|-------|-----|------------|
| Local | localhost:3000 | Разработка |
| Staging | staging.napare.ru | Пилот СИБИТ |
| Production | api.napare.ru | После пилота |

## Мониторинг

| Сервис | Назначение | URL |
|--------|------------|-----|
| Sentry | Ошибки | sentry.napare.ru |
| Grafana | Метрики | grafana.napare.ru |
| PostHog | Аналитика | posthog.napare.ru |

## Backup

- **PostgreSQL**: Ежедневный backup через pg_dump
- **Redis**: RDB snapshots каждые 15 минут
- **S3**: Versioning + lifecycle policies

## Преимущества
1. Простота на старте (Docker Compose)
2. Готовность к масштабированию (K8s)
3. Автоматический CI/CD
4. Мониторинг из коробки

## Связанные решения
- ADR-0001: Модульный монолит
- ADR-0005: Стек технологий
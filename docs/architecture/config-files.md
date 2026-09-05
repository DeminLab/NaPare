# Конфигурационные файлы

## 1. Корень монорепо

### `.env.example`

```bash
# ============================================
# НаПаре — Environment Variables
# ============================================

# ---------- Backend (NestJS) ----------
NODE_ENV=development
PORT=3000
API_PREFIX=api/v1

# Database
DATABASE_URL=postgresql://napare:napare@localhost:5432/napare_dev

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-super-secret-key-change-in-production
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=30d

# S3 (Yandex Object Storage / MinIO)
S3_ENDPOINT=https://storage.yandexcloud.net
S3_BUCKET=napare-files
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
S3_REGION=ru-central1

# Push Notifications
FCM_PROJECT_ID=your-firebase-project-id
FCM_PRIVATE_KEY=your-fcm-private-key
FCM_CLIENT_EMAIL=your-fcm-client-email

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100

# ---------- Web (Next.js) ----------
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=НаПаре

# ---------- MAX Mini-App ----------
VITE_API_URL=http://localhost:3000
VITE_MAX_BRIDGE_URL=https://bridge.example.com

# ---------- Monitoring ----------
SENTRY_DSN=
SENTRY_TRACES_SAMPLE_RATE=0.1
POSTHOG_KEY=
POSTHOG_HOST=https://app.posthog.com
```

### `docker-compose.yml` (Production)

```yaml
version: "3.9"

services:
  backend:
    build:
      context: .
      dockerfile: apps/backend/Dockerfile
    container_name: napare-backend
    restart: unless-stopped
    ports:
      - "3000:3000"
    env_file:
      - .env
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - napare

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    container_name: napare-web
    restart: unless-stopped
    ports:
      - "3001:3000"
    env_file:
      - .env
    networks:
      - napare

  db:
    image: postgres:16-alpine
    container_name: napare-db
    restart: unless-stopped
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: napare_prod
      POSTGRES_USER: napare
      POSTGRES_PASSWORD: ${DATABASE_PASSWORD:-napare}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U napare"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - napare

  redis:
    image: redis:7-alpine
    container_name: napare-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - napare

volumes:
  pgdata:
  redisdata:

networks:
  napare:
    driver: bridge
```

### `docker-compose.dev.yml` (Development)

```yaml
version: "3.9"

services:
  backend:
    build:
      context: .
      dockerfile: apps/backend/Dockerfile
      target: development
    container_name: napare-backend-dev
    ports:
      - "3000:3000"
    volumes:
      - ./apps/backend/src:/app/src
      - ./packages/shared:/app/packages/shared
    env_file:
      - .env
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - napare-dev
    command: npm run start:dev

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
      target: development
    container_name: napare-web-dev
    ports:
      - "3001:3000"
    volumes:
      - ./apps/web/src:/app/src
      - ./packages/shared:/app/packages/shared
    env_file:
      - .env
    networks:
      - napare-dev
    command: npm run dev

  db:
    image: postgres:16-alpine
    container_name: napare-db-dev
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: napare_dev
      POSTGRES_USER: napare
      POSTGRES_PASSWORD: napare
    volumes:
      - pgdata_dev:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U napare"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - napare-dev

  redis:
    image: redis:7-alpine
    container_name: napare-redis-dev
    ports:
      - "6379:6379"
    volumes:
      - redisdata_dev:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - napare-dev

  minio:
    image: minio/minio:latest
    container_name: napare-minio-dev
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    volumes:
      - miniodata:/data
    command: server /data --console-address ":9001"
    networks:
      - napare-dev

volumes:
  pgdata_dev:
  redisdata_dev:
  miniodata:

networks:
  napare-dev:
    driver: bridge
```

### `turbo.json`

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["build"]
    },
    "test:e2e": {
      "dependsOn": ["build"]
    },
    "db:generate": {
      "cache": false
    },
    "db:migrate": {
      "cache": false
    },
    "db:seed": {
      "cache": false
    },
    "clean": {
      "cache": false
    }
  }
}
```

### `pnpm-workspace.yaml`

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

### `package.json` (root)

```json
{
  "name": "napare",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "test": "turbo test",
    "test:e2e": "turbo test:e2e",
    "clean": "turbo clean",
    "db:generate": "turbo db:generate --filter=backend",
    "db:migrate": "turbo db:migrate --filter=backend",
    "db:seed": "turbo db:seed --filter=backend",
    "docker:dev": "docker compose -f docker-compose.dev.yml up -d",
    "docker:dev:down": "docker compose -f docker-compose.dev.yml down",
    "docker:prod": "docker compose up -d",
    "docker:prod:down": "docker compose down",
    "prepare": "husky install"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "husky": "^9.0.0",
    "lint-staged": "^15.0.0"
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,md,yaml,yml}": [
      "prettier --write"
    ]
  },
  "engines": {
    "node": ">=20",
    "pnpm": ">=9"
  }
}
```

---

## 2. Backend (NestJS)

### `apps/backend/package.json`

```json
{
  "name": "@napare/backend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:prod": "node dist/main",
    "lint": "eslint \"{src,test}/**/*.ts\" --fix",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:e2e": "jest --config ./test/jest-e2e.json",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:migrate:prod": "prisma migrate deploy",
    "db:seed": "ts-node prisma/seed.ts"
  },
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/jwt": "^10.0.0",
    "@nestjs/passport": "^10.0.0",
    "@nestjs/platform-express": "^10.0.0",
    "@nestjs/swagger": "^7.0.0",
    "@prisma/client": "^5.0.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.0",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "passport-local": "^1.0.0",
    "reflect-metadata": "^0.2.0",
    "rxjs": "^7.8.0"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.0.0",
    "@nestjs/schematics": "^10.0.0",
    "@nestjs/testing": "^10.0.0",
    "@types/express": "^4.17.21",
    "@types/jest": "^29.5.0",
    "@types/node": "^20.0.0",
    "@types/passport-jwt": "^4.0.0",
    "@types/passport-local": "^1.0.0",
    "jest": "^29.7.0",
    "prisma": "^5.0.0",
    "ts-jest": "^29.1.0",
    "ts-node": "^10.9.0",
    "typescript": "^5.3.0"
  }
}
```

### `apps/backend/.env.example`

```bash
# Backend-only environment variables
NODE_ENV=development
PORT=3000
API_PREFIX=api/v1

# Database
DATABASE_URL=postgresql://napare:napare@localhost:5432/napare_dev

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=dev-secret-change-in-production
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=30d

# S3 (MinIO for dev)
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=napare-files
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true

# Push (dev - use FCM test project)
FCM_PROJECT_ID=
FCM_PRIVATE_KEY=
FCM_CLIENT_EMAIL=

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100
```

---

## 3. Web (Next.js)

### `apps/web/package.json`

```json
{
  "name": "@napare/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "@tanstack/react-query": "^5.0.0",
    "axios": "^1.6.0",
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "zustand": "^4.4.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "autoprefixer": "^10.4.0",
    "eslint": "^8.56.0",
    "eslint-config-next": "^14.0.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.3.0"
  }
}
```

### `apps/web/.env.local.example`

```bash
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=НаПаре
```

---

## 4. MAX Mini-App (React + Vite)

### `apps/max-miniapp/package.json`

```json
{
  "name": "@napare/max-miniapp",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint src --ext ts,tsx --fix"
  },
  "dependencies": {
    "axios": "^1.6.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0"
  }
}
```

---

## 5. Packages (Shared)

### `packages/shared/package.json`

```json
{
  "name": "@napare/shared",
  "version": "0.1.0",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "lint": "eslint src --ext ts --fix"
  },
  "dependencies": {
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0"
  }
}
```

### `packages/api-client/package.json`

```json
{
  "name": "@napare/api-client",
  "version": "0.1.0",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "generate": "openapi-generator-cli generate",
    "build": "tsc",
    "lint": "eslint src --ext ts --fix"
  },
  "devDependencies": {
    "@openapitools/openapi-generator-cli": "^2.7.0",
    "typescript": "^5.3.0"
  }
}
```

### `packages/ui/package.json`

```json
{
  "name": "@napare/ui",
  "version": "0.1.0",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "jest",
    "lint": "eslint src --ext ts,tsx --fix"
  },
  "peerDependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@testing-library/react": "^14.0.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "jest": "^29.7.0",
    "typescript": "^5.3.0"
  }
}
```

---

## Запуск

```bash
# 1. Установка зависимостей
pnpm install

# 2. Копирование переменных окружения
cp .env.example .env
cp apps/backend/.env.example apps/backend/.env
cp apps/web/.env.local.example apps/web/.env.local

# 3. Запуск инфраструктуры (PostgreSQL, Redis, MinIO)
docker compose -f docker-compose.dev.yml up -d db redis minio

# 4. Генерация Prisma-клиента и миграции
cd apps/backend
pnpm db:generate
pnpm db:migrate
pnpm db:seed
cd ../..

# 5. Запуск всех сервисов
pnpm dev
```

---

## Доступ к сервисам (Development)

| Сервис | URL |
|--------|-----|
| Backend API | http://localhost:3000 |
| Swagger Docs | http://localhost:3000/api/docs |
| Web App | http://localhost:3001 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |
| MinIO Console | http://localhost:9001 |

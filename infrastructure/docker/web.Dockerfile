# Универсальный Dockerfile для всех веб-приложений (web-portal, web-student, web-staff, web-admin, web-developer).
# Путь к приложению передаётся как build-arg APP_DIR, поэтому сборка каждого фронтенда
# тянет зависимости только этого приложения и кэшируется независимо.
# BACKEND_URL нужен на этапе build: next.config.js резолвит rewrites для /api/*
# во время next build и записывает их в routes-manifest, поэтому runtime-ENV
# на них уже не влияет — без build-arg прокси указывает на сам контейнер.
ARG APP_DIR
ARG PACKAGE_NAME
ARG BACKEND_URL=http://localhost:3000
ARG NEXT_PUBLIC_STUDENT_URL
ARG NEXT_PUBLIC_TEACHER_URL
ARG NEXT_PUBLIC_ADMIN_URL
ARG NEXT_PUBLIC_DEVELOPER_URL

FROM node:20-alpine AS builder
ARG APP_DIR
ARG PACKAGE_NAME
ARG BACKEND_URL
ARG NEXT_PUBLIC_STUDENT_URL
ARG NEXT_PUBLIC_TEACHER_URL
ARG NEXT_PUBLIC_ADMIN_URL
ARG NEXT_PUBLIC_DEVELOPER_URL
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/package.json
COPY apps/max-miniapp/package.json ./apps/max-miniapp/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY apps/web-portal/package.json ./apps/web-portal/package.json
COPY apps/web-student/package.json ./apps/web-student/package.json
COPY apps/web-staff/package.json ./apps/web-staff/package.json
COPY apps/web-admin/package.json ./apps/web-admin/package.json
COPY apps/web-developer/package.json ./apps/web-developer/package.json
COPY packages/api-client/package.json ./packages/api-client/package.json
COPY packages/design-tokens/package.json ./packages/design-tokens/package.json
COPY packages/ui/package.json ./packages/ui/package.json
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --filter "${PACKAGE_NAME}..." --frozen-lockfile

COPY ${APP_DIR}/ ./${APP_DIR}/
COPY packages/design-tokens ./packages/design-tokens
COPY packages/ui ./packages/ui
ENV BACKEND_URL=${BACKEND_URL}
ENV NEXT_PUBLIC_STUDENT_URL=${NEXT_PUBLIC_STUDENT_URL}
ENV NEXT_PUBLIC_TEACHER_URL=${NEXT_PUBLIC_TEACHER_URL}
ENV NEXT_PUBLIC_ADMIN_URL=${NEXT_PUBLIC_ADMIN_URL}
ENV NEXT_PUBLIC_DEVELOPER_URL=${NEXT_PUBLIC_DEVELOPER_URL}
RUN pnpm --filter "${PACKAGE_NAME}" build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --chown=node:node --from=builder /app/.next/standalone ./
COPY --chown=node:node --from=builder /app/.next/static ./.next/static

EXPOSE 3000

USER node

CMD ["node", "server.js"]

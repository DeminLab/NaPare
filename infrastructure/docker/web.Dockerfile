# Универсальный Dockerfile для всех веб-приложений (web-portal, web-student, web-staff, web-admin, web-developer).
# Путь к приложению передаётся как build-arg APP_DIR, поэтому сборка каждого фронтенда
# тянет зависимости только этого приложения и кэшируется независимо.
# BACKEND_URL нужен на этапе build: next.config.js резолвит rewrites для /api/*
# во время next build и записывает их в routes-manifest, поэтому runtime-ENV
# на них уже не влияет — без build-arg прокси указывает на сам контейнер.
ARG APP_DIR
ARG BACKEND_URL=http://localhost:3000
ARG NEXT_PUBLIC_STUDENT_URL
ARG NEXT_PUBLIC_TEACHER_URL
ARG NEXT_PUBLIC_ADMIN_URL
ARG NEXT_PUBLIC_DEVELOPER_URL

FROM node:20-alpine AS builder
ARG APP_DIR
ARG BACKEND_URL
ARG NEXT_PUBLIC_STUDENT_URL
ARG NEXT_PUBLIC_TEACHER_URL
ARG NEXT_PUBLIC_ADMIN_URL
ARG NEXT_PUBLIC_DEVELOPER_URL
WORKDIR /app

COPY ${APP_DIR}/package.json ./package.json
RUN --mount=type=cache,target=/root/.npm npm install --no-audit --no-fund

COPY ${APP_DIR}/ ./
ENV BACKEND_URL=${BACKEND_URL}
ENV NEXT_PUBLIC_STUDENT_URL=${NEXT_PUBLIC_STUDENT_URL}
ENV NEXT_PUBLIC_TEACHER_URL=${NEXT_PUBLIC_TEACHER_URL}
ENV NEXT_PUBLIC_ADMIN_URL=${NEXT_PUBLIC_ADMIN_URL}
ENV NEXT_PUBLIC_DEVELOPER_URL=${NEXT_PUBLIC_DEVELOPER_URL}
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --chown=node:node --from=builder /app/.next/standalone ./
COPY --chown=node:node --from=builder /app/.next/static ./.next/static

EXPOSE 3000

USER node

CMD ["node", "server.js"]

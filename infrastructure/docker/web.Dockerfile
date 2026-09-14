# Универсальный Dockerfile для всех веб-приложений (web-student, web-staff, web-admin, web-developer).
# Путь к приложению передаётся как build-arg APP_DIR, поэтому сборка каждого фронтенда
# тянет зависимости только этого приложения и кэшируется независимо.
ARG APP_DIR

FROM node:20-alpine AS builder
ARG APP_DIR
WORKDIR /app

COPY ${APP_DIR}/package.json ./package.json
RUN --mount=type=cache,target=/root/.npm npm install --no-audit --no-fund

COPY ${APP_DIR}/ ./
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

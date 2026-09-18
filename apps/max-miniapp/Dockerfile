FROM node:20-alpine AS builder

WORKDIR /app

# Use the repository lockfile and avoid the npm installer crash observed on the server.
ENV NODE_ENV=development
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/max-miniapp/package.json apps/max-miniapp/package.json
RUN pnpm install --frozen-lockfile --filter @napare/max-miniapp --prod=false \
    && test -x node_modules/.bin/tsc \
    && test -x node_modules/.bin/vite

COPY apps/max-miniapp/ ./apps/max-miniapp/
RUN pnpm --filter @napare/max-miniapp build

FROM nginxinc/nginx-unprivileged:1.27-alpine

COPY --from=builder /app/apps/max-miniapp/dist /usr/share/nginx/html
COPY apps/max-miniapp/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

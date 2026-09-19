FROM node:20-alpine AS builder

WORKDIR /app

# Use the app lockfile and avoid the npm installer crash observed on the server.
ENV NODE_ENV=development
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

COPY apps/max-miniapp/package.json apps/max-miniapp/package-lock.json ./
RUN pnpm import \
    && pnpm install --frozen-lockfile --prod=false \
    && test -x node_modules/.bin/tsc \
    && test -x node_modules/.bin/vite

COPY apps/max-miniapp/ ./
RUN pnpm build

FROM nginxinc/nginx-unprivileged:1.27-alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY apps/max-miniapp/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

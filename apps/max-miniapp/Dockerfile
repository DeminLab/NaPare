FROM node:20-alpine AS builder

WORKDIR /app

COPY apps/max-miniapp/package.json apps/max-miniapp/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY apps/max-miniapp/ ./
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.27-alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY apps/max-miniapp/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

FROM node:20-alpine AS builder

WORKDIR /app

# Keep build-time tooling available even when the host Compose environment is production.
ENV NODE_ENV=development

COPY apps/max-miniapp/package.json apps/max-miniapp/package-lock.json ./
# The production image is assembled from the build stage, so TypeScript/Vite
# devDependencies are required here even when the host exports NODE_ENV=production.
RUN npm install --include=dev --production=false --no-audit --no-fund \
    && test -x node_modules/.bin/tsc \
    && test -x node_modules/.bin/vite

COPY apps/max-miniapp/ ./
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.27-alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY apps/max-miniapp/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

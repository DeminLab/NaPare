FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY apps/backend/package.json ./package.json
RUN npm_config_build_from_source=true npm install --include=dev --no-audit --no-fund

COPY apps/backend/src ./src
COPY apps/backend/nest-cli.json ./
COPY apps/backend/tsconfig.json ./

RUN npx nest build
RUN npm prune --omit=dev

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV production

COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/package.json ./

EXPOSE 3000

USER node

CMD ["node", "dist/main"]

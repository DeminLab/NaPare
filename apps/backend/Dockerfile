FROM node:20-alpine AS builder

WORKDIR /app

COPY apps/backend/package.json ./package.json
RUN npm install

COPY apps/backend/src ./src
COPY apps/backend/nest-cli.json ./
COPY apps/backend/tsconfig.json ./

RUN npx nest build

FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

EXPOSE 3000

CMD ["node", "dist/main"]

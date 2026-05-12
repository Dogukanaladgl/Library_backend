FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM deps AS build
COPY . .
RUN pnpm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --prod --frozen-lockfile --ignore-scripts
COPY --from=build --chown=nestjs:nodejs /app/dist ./dist

USER nestjs
EXPOSE 3000
CMD ["sh", "-c", "node node_modules/typeorm/cli.js -d dist/database/data-source.js migration:run && (node dist/database/seeds/seed.js || echo '[seed] atlandi/hatali, uygulama baslatiliyor'); exec node dist/main.js"]

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
ENV NODE_ENV=production PORT=8081

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --prod --frozen-lockfile --ignore-scripts
COPY --from=build --chown=nestjs:nodejs /app/dist ./dist

USER nestjs
EXPOSE 8081
# Not: seed komutu kaldirildi. Veritabanindaki veri olduğu gibi korunur;
# random masa/QR üretimi yapilmaz. Manuel import gerekiyorsa imajda elle
# `node dist/database/seeds/import-qr-from-csv.js` benzeri çağırılabilir.
CMD ["sh", "-c", "node node_modules/typeorm/cli.js -d dist/database/data-source.js migration:run && exec node dist/main.js"]

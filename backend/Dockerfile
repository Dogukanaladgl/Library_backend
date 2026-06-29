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

ARG VERSION=dev
LABEL org.opencontainers.image.title="kutuphane-backend" \
      org.opencontainers.image.description="Selçuk Üniversitesi Kütüphane Rezervasyon API" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.source="https://github.com/Selcuk-Dijital/kutuphane-backend"

ENV NODE_ENV=production \
    PORT=8081 \
    NODE_EXTRA_CA_CERTS=/app/certs/selcuk-api-ca.pem

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs && \
    apk add --no-cache ca-certificates

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --prod --frozen-lockfile --ignore-scripts
COPY --from=build --chown=nestjs:nodejs /app/dist ./dist
COPY --chown=nestjs:nodejs certs ./certs

USER nestjs
EXPOSE 8081

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "const p=process.env.PORT||8081; require('http').get('http://127.0.0.1:'+p+'/api/docs', (r) => { r.resume(); process.exit(r.statusCode < 500 ? 0 : 1); }).on('error', () => process.exit(1))"

# Not: seed komutu kaldirildi. Veritabanindaki veri olduğu gibi korunur;
# random masa/QR üretimi yapilmaz. Manuel import gerekiyorsa imajda elle
# `node dist/database/seeds/import-qr-from-csv.js` benzeri çağırılabilir.
CMD ["sh", "-c", "node node_modules/typeorm/cli.js -d dist/database/data-source.js migration:run && exec node dist/main.js"]

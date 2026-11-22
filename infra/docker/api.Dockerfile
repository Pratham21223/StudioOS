# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS build

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm ci --ignore-scripts

COPY packages/shared packages/shared
COPY apps/api apps/api

RUN npm run build -w @studioos/shared \
  && npm run build -w @studioos/api \
  && npm prune --omit=dev

FROM node:24-bookworm-slim AS runtime

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates curl \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system studioos \
  && useradd --system --gid studioos --home /app studioos

ENV NODE_ENV=production
WORKDIR /app

COPY --from=build --chown=studioos:studioos /app/package.json /app/package-lock.json ./
COPY --from=build --chown=studioos:studioos /app/node_modules ./node_modules
COPY --from=build --chown=studioos:studioos /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build --chown=studioos:studioos /app/packages/shared/dist ./packages/shared/dist
COPY --from=build --chown=studioos:studioos /app/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=studioos:studioos /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=studioos:studioos /app/apps/api/prisma ./apps/api/prisma

USER studioos
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:4000/health || exit 1

CMD ["node", "apps/api/dist/server.js"]

# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY libs ./libs
COPY services/rag/package.json ./services/rag/package.json
RUN pnpm install --frozen-lockfile --filter @accessmate/rag...

FROM deps AS build
RUN pnpm --filter @accessmate/rag build

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/services/rag/dist ./dist
COPY services/rag/package.json ./package.json
CMD ["node", "dist/server.js"]

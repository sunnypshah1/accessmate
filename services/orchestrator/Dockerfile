# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY libs ./libs
COPY services/orchestrator/package.json ./services/orchestrator/package.json
COPY services/dynamic-audit/package.json ./services/dynamic-audit/package.json
RUN pnpm install --frozen-lockfile --filter @accessmate/orchestrator...

FROM deps AS build
RUN pnpm --filter @accessmate/orchestrator build

FROM node:20-alpine AS runtime
ENV NODE_ENV=production
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/services/orchestrator/dist ./dist
COPY services/orchestrator/package.json ./package.json
CMD ["node", "dist/worker.js"]

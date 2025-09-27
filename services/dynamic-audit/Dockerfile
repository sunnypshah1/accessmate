# syntax=docker/dockerfile:1.7
FROM mcr.microsoft.com/playwright:v1.47.0-jammy AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY libs ./libs
COPY services/dynamic-audit/package.json ./services/dynamic-audit/package.json
RUN pnpm install --frozen-lockfile --filter @accessmate/dynamic-audit...

FROM deps AS build
RUN pnpm --filter @accessmate/dynamic-audit build

FROM base AS runtime
ENV NODE_ENV=production
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/services/dynamic-audit/dist ./dist
COPY services/dynamic-audit/package.json ./package.json
CMD ["node", "dist/index.js"]

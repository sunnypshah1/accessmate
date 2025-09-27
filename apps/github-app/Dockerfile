FROM node:20-alpine
WORKDIR /app
COPY . .
RUN corepack enable && pnpm i --frozen-lockfile && pnpm -r build
CMD ["node", "dist/index.js"]
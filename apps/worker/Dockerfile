FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copy package manifests
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY apps/worker/package.json ./apps/worker/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter worker...

# Copy source code
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY packages/db ./packages/db
COPY apps/worker ./apps/worker

# Build worker
RUN pnpm --filter worker build

# Non-root user for security compliance
USER node
EXPOSE 4000

ENV NODE_ENV=production
CMD ["node", "apps/worker/dist/index.js"]

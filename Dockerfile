# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package manifests and Prisma schema
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Generate Prisma client
RUN pnpm exec prisma generate

# Copy config and source code
COPY tsconfig*.json nest-cli.json ./
COPY src ./src

# Build production bundles
RUN pnpm run build

# Stage 2: Production runtime
FROM node:22-alpine AS runner

WORKDIR /app

RUN npm install -g pnpm

ENV NODE_ENV=production
ENV PORT=4000

# Copy manifests and Prisma schema
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile && pnpm exec prisma generate

# Copy built application from builder
COPY --from=builder /app/dist ./dist

EXPOSE 4000

CMD ["node", "dist/main.js"]

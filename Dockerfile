# Multi-stage Production Dockerfile for Node.js 20.x
# Stage 1: Build environment (includes devDependencies for Vite & TypeScript compilation)
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package definition
COPY package.json ./

# Execute npm install to resolve/regenerate package-lock.json with Node 20 and install devDependencies
RUN npm install --legacy-peer-deps

# Copy project source files
COPY . .

# Compile and build production Vite assets into /app/dist
RUN npm run build

# Stage 2: Minimal production runtime environment
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0

# Copy package definition and newly synchronized package-lock.json from builder
COPY package.json ./
COPY --from=builder /app/package-lock.json ./

# Install strictly production dependencies (omitting devDependencies for lightweight image)
RUN npm install --omit=dev --legacy-peer-deps

# Copy compiled frontend distribution from builder
COPY --from=builder /app/dist ./dist

# Copy backend server code and configurations
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/src ./src
COPY --from=builder /app/firebase-applet-config.json ./firebase-applet-config.json
COPY --from=builder /app/.env* ./

# Dynamic healthcheck probe for Railway, Render and container orchestrators
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3000}/health || exit 1

# Start the full-stack Express server
CMD ["npm", "start"]

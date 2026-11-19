# ==========================================
# Multi-stage Dockerfile: Backend Web Portal Siswa
# ==========================================

# Stage 1: Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies (termasuk devDependencies untuk build tsc)
COPY package*.json tsconfig.json ./
RUN npm ci

# Copy source code dan schema
COPY src/ ./src/
COPY schema.sql seed.sql ./

# Compile TypeScript ke dist/
RUN npm run build

# Bersihkan devDependencies untuk memangkas ukuran image produksi
RUN npm prune --omit=dev

# Stage 2: Production runner stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Buat direktori uploads dan beri hak akses ke user node
RUN mkdir -p /app/uploads && chown -R node:node /app

# Salin hasil build dan dependensi produksi dari builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/schema.sql ./schema.sql
COPY --from=builder /app/seed.sql ./seed.sql

# Beralih ke non-root user demi keamanan
USER node

EXPOSE 3000

CMD ["node", "dist/server.js"]

# Contexto de build: raíz del repo (npm workspaces comparten un solo lockfile).
FROM node:24-alpine AS deps
WORKDIR /app
# Toolchain para compilar módulos nativos (better-sqlite3).
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci -w backend --include-workspace-root=false

FROM deps AS build
COPY backend backend
RUN npm run build -w backend \
 && npm prune --omit=dev -w backend --include-workspace-root=false

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/backend/package.json backend/
COPY --from=build /app/backend/dist backend/dist
COPY --from=build /app/backend/drizzle backend/drizzle
RUN mkdir -p backend/data && chown -R node:node backend/data
USER node
WORKDIR /app/backend
EXPOSE 3000
CMD ["node", "dist/main.js"]

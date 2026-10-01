# ---- build ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY tsconfig*.json prisma.config.ts ./
COPY prisma ./prisma
COPY src ./src
RUN npx prisma generate && npm run build

# ---- runtime ----
FROM node:22-alpine
# NODE_ENV là BẮT BUỘC (app từ chối khởi động nếu thiếu); image này luôn là production.
ENV NODE_ENV=production
WORKDIR /app
RUN apk add --no-cache openssl
# `prisma` (CLI) là dependency thường để chạy `prisma migrate deploy` ngay trong container; cần prisma/ + prisma.config.ts.
# Không dùng --ignore-scripts: @prisma/engines tải schema-engine ở postinstall.
COPY package*.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY docker-entrypoint.sh ./
RUN sed -i 's/\r$//' docker-entrypoint.sh && chmod +x docker-entrypoint.sh && chown -R node:node /app
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:${PORT:-4000}/health || exit 1
# RUN_MIGRATIONS=1 để chạy migration lúc khởi động; mặc định chỉ start API.
CMD ["./docker-entrypoint.sh"]

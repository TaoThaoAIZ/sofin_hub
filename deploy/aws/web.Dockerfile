# Build frontend (Vite) rồi phục vụ bằng Nginx kèm reverse-proxy /api -> backend.
# VITE_API_URL mặc định '/api' (cùng origin) nên không cần CORS và không cần biết IP/domain lúc build.
FROM node:22-alpine AS build
WORKDIR /app
COPY src/frontend/package*.json ./
RUN npm ci
COPY src/frontend/ ./
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

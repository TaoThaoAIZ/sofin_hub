#!/usr/bin/env bash
# Chạy TRÊN SERVER (root, qua AWS SSM do workflow .github/workflows/deploy.yml gọi): thay source mới và dựng lại stack.
# Dùng: remote-deploy.sh <bundle.tgz>   (bundle chứa backend/, frontend/, deploy/aws/)
# KHÔNG đụng /opt/app/.env (bí mật) và /opt/app/nginx/default.conf (đã gắn hostname + HTTPS riêng của server).
set -euo pipefail
export HOME=/root
APP=/opt/app
BUNDLE="$1"

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
tar xzf "$BUNDLE" -C "$TMP"

rm -rf "$APP/src/backend" "$APP/src/frontend" "$APP/src/deploy"
mkdir -p "$APP/src" "$APP/nginx"
cp -r "$TMP/backend" "$TMP/frontend" "$TMP/deploy" "$APP/src/"
cp "$APP/src/deploy/aws/docker-compose.yml" "$APP/docker-compose.yml"
cp "$APP/src/deploy/aws/web.Dockerfile" "$APP/web.Dockerfile"
cp "$APP/src/deploy/aws/nginx/https.conf.example" "$APP/nginx/https.conf.example"
chown -R ubuntu:ubuntu "$APP/src"

cd "$APP"
docker compose config -q
docker compose up -d --build

# Chờ stack khỏe (qua Nginx -> backend, kiểm cả DB): tối đa ~3 phút.
code=000
for _ in $(seq 1 36); do
  code=$(curl -sk -o /dev/null -w '%{http_code}' --max-time 5 https://127.0.0.1/health || true)
  [ "$code" = "200" ] && break
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1/health || true)
  [ "$code" = "200" ] && break
  sleep 5
done
if [ "$code" != "200" ]; then
  echo "Health check that bai (HTTP $code). Log backend:"
  docker compose logs backend --tail 40 || true
  echo DEPLOY_FAILED
  exit 1
fi

docker image prune -f >/dev/null || true
echo "DEPLOY_OK $(date -Is)"

#!/usr/bin/env bash
# Chạy TRÊN SERVER (root): thêm một domain mới cho web — xin cert Let's Encrypt, thêm block 443 vào /opt/app/nginx/default.conf,
# nạp lại nginx. Domain cũ (vd. *.sslip.io) vẫn hoạt động. Chạy lại cùng domain là an toàn (bỏ qua nếu đã có).
# Dùng: sudo bash add-domain.sh <host> <email-nhận-cảnh-báo-cert>      vd. add-domain.sh hub.taothaoai.com me@example.com
# ĐIỀU KIỆN: bản ghi A của <host> đã trỏ về IP server (kiểm: nslookup <host> 8.8.8.8) và cổng 80/443 đã mở.
set -euo pipefail
HOST="${1:?thiếu host}"; EMAIL="${2:?thiếu email}"
APP=/opt/app; CONF="$APP/nginx/default.conf"
[[ "$HOST" =~ ^[a-z0-9.-]+\.[a-z]{2,}$ ]] || { echo "Host không hợp lệ: $HOST"; exit 1; }
[ "$(id -u)" = 0 ] || { echo "Cần chạy bằng root"; exit 1; }

if [ ! -f "/etc/letsencrypt/live/$HOST/fullchain.pem" ]; then
  command -v certbot >/dev/null || { apt-get update -y && apt-get install -y certbot; }
  mkdir -p "$APP/certbot-www"
  certbot certonly --webroot -w "$APP/certbot-www" -d "$HOST" --agree-tos -m "$EMAIL" --no-eff-email -n
fi

if grep -q "server_name $HOST;" "$CONF"; then
  echo "nginx đã có $HOST, bỏ qua bước sửa cấu hình."
else
  cp "$CONF" "$CONF.bak-$(date +%Y%m%d%H%M%S)"
  HOST="$HOST" CONF="$CONF" python3 - <<'PY'
import os, re
host, path = os.environ['HOST'], os.environ['CONF']
s = open(path).read()
# Redirect cổng 80 theo domain người dùng gõ.
s = re.sub(r'return 301 https://[^\s$;]+\$request_uri;', 'return 301 https://$host$request_uri;', s)
# Tách các block `server { ... }` ở cấp ngoài cùng.
blocks, depth, start = [], 0, None
for i, ch in enumerate(s):
    if ch == '{':
        if depth == 0: start = s.rfind('server', 0, i)
        depth += 1
    elif ch == '}':
        depth -= 1
        if depth == 0: blocks.append((start, i + 1))
tls = [b for b in blocks if 'listen 443' in s[b[0]:b[1]]]
if not tls: raise SystemExit('Không tìm thấy block 443 trong default.conf (chưa bật HTTPS?)')
src = s[tls[0][0]:tls[0][1]]
old = re.search(r'server_name\s+([^;\s]+);', src).group(1)
new = src.replace(old, host).replace(' default_server', '')
s = s[:tls[-1][1]] + '\n\n' + new + s[tls[-1][1]:]
open(path, 'w').write(s)
PY
fi

cd "$APP"
docker compose up -d --build web
for _ in $(seq 1 12); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 --resolve "$HOST:443:127.0.0.1" "https://$HOST/health" || true)
  [ "$code" = "200" ] && { echo "OK: https://$HOST/health -> 200"; exit 0; }
  sleep 3
done
echo "Health check lỗi (HTTP $code). Khôi phục: cp $CONF.bak-* $CONF && docker compose up -d --build web"; exit 1

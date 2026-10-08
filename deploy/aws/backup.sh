#!/usr/bin/env bash
# Sao lưu Postgres lên S3 (prefix backups/). Cron trên server chạy mỗi 03:00: /etc/cron.d/sofinhub-backup
# Bản cũ hơn 14 ngày do lifecycle rule "expire-backups-14d" của bucket tự xóa. Cài tại /opt/app/backup.sh.
set -euo pipefail
cd /opt/app
F="s3://sofinhub-uploads-989735870224/backups/db-$(date +%F).sql.gz"
docker compose exec -T postgres pg_dump -U sofinhub sofinhub | gzip | aws s3 cp - "$F" --region ap-southeast-2
echo "$(date -Is) backup OK -> $F"

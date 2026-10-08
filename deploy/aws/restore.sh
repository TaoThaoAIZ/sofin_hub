#!/usr/bin/env bash
# Khôi phục 1 bản backup vào một database MỚI (không bao giờ ghi đè DB đang chạy).
# Dùng (trên server): bash restore.sh db-2026-10-08.sql.gz sofinhub_restored
# Sau đó kiểm tra dữ liệu; muốn dùng thật thì đổi DATABASE_URL trong /opt/app/.env sang DB mới rồi `docker compose up -d backend`.
#
# VÌ SAO phải lọc dòng set_config: pg_dump đặt search_path rỗng, nhưng schema của dự án có hàm SQL gọi hàm khác không ghi
# tên schema (sf_fold) nên restore trực tiếp lỗi "function sf_fold(text) does not exist". Bỏ dòng đó là cách khắc phục đã thử đạt.
set -euo pipefail
FILE="$1"; TARGET="$2"
cd /opt/app
P="docker compose exec -T postgres"
[[ "$TARGET" =~ ^[a-z0-9_]+$ ]] || { echo "Tên DB chỉ gồm chữ thường, số, _"; exit 1; }
[ "$TARGET" != "sofinhub" ] || { echo "Không khôi phục đè lên DB đang chạy (sofinhub). Chọn tên DB mới."; exit 1; }
if [ ! -f "$FILE" ]; then
  aws s3 cp "s3://sofinhub-uploads-989735870224/backups/$FILE" /tmp/restore.sql.gz --region ap-southeast-2 --only-show-errors
  FILE=/tmp/restore.sql.gz
fi
$P psql -U sofinhub -d postgres -qc "CREATE DATABASE $TARGET"
gunzip -c "$FILE" | grep -v "set_config('search_path', '', false)" | $P psql -U sofinhub -d "$TARGET" -q -v ON_ERROR_STOP=1 >/dev/null
echo "Đã khôi phục vào DB '$TARGET'. Số user: $($P psql -U sofinhub -d "$TARGET" -tAc 'select count(*) from "User"')"

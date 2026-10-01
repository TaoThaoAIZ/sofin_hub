#!/bin/sh
# Entrypoint production: (tuy chon) chay migration truoc khi khoi dong API.
#   RUN_MIGRATIONS=1  -> chay `prisma migrate deploy` roi moi start (an toan khi chay nhieu instance: Prisma co advisory lock).
# Neu nen tang co "release/pre-deploy command" (Render, Heroku, ECS task rieng) thi dung do thay vi bat co nay.
set -e
if [ "$RUN_MIGRATIONS" = "1" ]; then
  echo "[entrypoint] prisma migrate deploy"
  npx prisma migrate deploy
fi
# RUN_ROLE=worker -> chi chay job nen (src/worker.ts), khong mo cong HTTP.
if [ "$RUN_ROLE" = "worker" ]; then exec node dist/worker.js; fi
exec node dist/index.js

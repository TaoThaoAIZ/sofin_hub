/**
 * Chuyển mã MỘT LẦN các video bài học đã upload từ trước (MediaConvert). Các video mới tự chuyển mã khi upload xong,
 * còn video cũ cũng tự được tạo job ở lần đầu có người xem; script này chỉ để làm sớm, không cần chờ có người xem.
 * Chạy trên server (cần MEDIACONVERT_ROLE_ARN + S3_BUCKET trong .env): docker compose exec backend npx tsx prisma/optimize-videos.ts
 */
import { prisma } from '../src/db/prisma.js';
import { uploadService } from '../src/modules/uploads/uploads.service.js';
import { optimizeEnabled } from '../src/modules/uploads/video-optimize.js';

if (!optimizeEnabled()) {
  console.error('Chưa bật: thiếu MEDIACONVERT_ROLE_ARN hoặc S3_BUCKET');
  process.exit(1);
}
const rows = await prisma.upload.findMany({ where: { purpose: 'lesson_video', status: 'uploaded', webStatus: null, removedAt: null }, select: { key: true, size: true } });
console.log(`Cần chuyển mã ${rows.length} video`);
for (const r of rows) {
  const rec = await uploadService.getServable(r.key);
  if (!rec) continue;
  const state = await uploadService.ensureWebRendition(rec);
  console.log(r.key, `${Math.round(r.size / 1e6)}MB`, '->', state);
}
await prisma.$disconnect();

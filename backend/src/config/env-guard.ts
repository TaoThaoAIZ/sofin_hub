/**
 * Kiểm tra cấu hình khi NODE_ENV=production. Hàm thuần (không đọc process.env, không thoát process) để test được.
 * Trả về danh sách vấn đề; rỗng = ổn.
 */
export function productionEnvProblems(cfg: Record<string, unknown>): string[] {
  if (cfg.NODE_ENV !== 'production') return [];
  const problems: string[] = [];
  // Mọi giá trị chuỗi bắt đầu bằng `dev-` (default công khai trong repo) đều bị chặn: JWT_*, UPLOAD_SIGNING_SECRET, ...
  for (const [key, value] of Object.entries(cfg)) {
    if (typeof value === 'string' && value.startsWith('dev-')) {
      problems.push(`${key} đang là giá trị mặc định dev-* — phải đặt giá trị bí mật riêng`);
    }
  }
  if (!cfg.DATABASE_URL) problems.push('DATABASE_URL bắt buộc khi production (không có giá trị mặc định)');
  if (cfg.ENABLE_DEV_OUTBOX) problems.push('ENABLE_DEV_OUTBOX không được bật khi production (lộ token đặt lại mật khẩu)');
  return problems;
}

/**
 * Cảnh báo (KHÔNG thoát) về chế độ triển khai: chạy NHIỀU instance mà không có Redis thì SSE/vé/rate limit/throttle lệch giữa các
 * instance (xem docs/CONVENTIONS.md "State chia sẻ"). 1 instance không Redis là hợp lệ. Số instance lấy từ gợi ý của nền tảng/người vận hành:
 * INSTANCE_COUNT hoặc WEB_CONCURRENCY > 1. Hàm thuần để test được.
 */
export function productionEnvWarnings(cfg: Record<string, unknown>, hints: Record<string, string | undefined> = {}): string[] {
  if (cfg.NODE_ENV !== 'production') return [];
  const warnings: string[] = [];
  const instances = Math.max(Number(hints.INSTANCE_COUNT) || 1, Number(hints.WEB_CONCURRENCY) || 1);
  if (!cfg.REDIS_URL && instances > 1) {
    warnings.push(
      `Phát hiện ${instances} instance nhưng REDIS_URL chưa đặt: SSE realtime, vé stream/upload, rate limit và throttle thông báo sẽ lệch giữa các instance. ` +
        'Nhiều instance BẮT BUỘC có Redis (1 instance không Redis thì ổn).',
    );
  }
  if (!cfg.REDIS_URL && cfg.RUN_SCHEDULERS === false) {
    warnings.push(
      'RUN_SCHEDULERS=0 (web-only) mà chưa có REDIS_URL: thông báo do worker tạo vẫn được lưu DB nhưng KHÔNG đẩy realtime (SSE) tới web — cần Redis để worker và web chia sẻ pub/sub.',
    );
  }
  if (!cfg.BANK_ACCOUNT) warnings.push('BANK_ACCOUNT chưa đặt: checkout thành viên/mua module sẽ trả 503 (không có tài khoản nhận tiền).');
  if (!cfg.SEPAY_WEBHOOK_KEY) warnings.push('SEPAY_WEBHOOK_KEY chưa đặt: MỌI webhook SePay bị từ chối; chỉ cron quét (cần SEPAY_API_TOKEN) mới cộng tiền.');
  if (!cfg.SEPAY_API_TOKEN) warnings.push('SEPAY_API_TOKEN chưa đặt: không có cron quét đối soát — nếu webhook hỏng thì tiền về sẽ không tự cộng (chỉ admin duyệt tay).');
  return warnings;
}

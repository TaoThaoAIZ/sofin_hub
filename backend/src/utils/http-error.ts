export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }

  static notFound(message = 'Không tìm thấy tài nguyên') {
    return new HttpError(404, 'NOT_FOUND', message);
  }

  static badRequest(message: string, details?: unknown) {
    return new HttpError(400, 'BAD_REQUEST', message, details);
  }

  /** Dữ liệu đầu vào không hợp lệ (400, mã VALIDATION_ERROR — cùng mã với lỗi zod trong error-handler). */
  static validation(message: string, details?: unknown) {
    return new HttpError(400, 'VALIDATION_ERROR', message, details);
  }

  static unauthorized(message = 'Vui lòng đăng nhập để tiếp tục') {
    return new HttpError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'Bạn không có quyền thực hiện thao tác này') {
    return new HttpError(403, 'FORBIDDEN', message);
  }

  static conflict(message: string) {
    return new HttpError(409, 'CONFLICT', message);
  }

  /** Lỗi với mã nghiệp vụ riêng (vd. PAYMENT_REQUIRED, COMMUNITY_LOCKED) để FE phân biệt. */
  static coded(status: number, code: string, message: string, details?: unknown) {
    return new HttpError(status, code, message, details);
  }

  static tooMany(message = 'Bạn thao tác quá nhanh, vui lòng thử lại sau') {
    return new HttpError(429, 'TOO_MANY_REQUESTS', message);
  }
}

import { randomBytes } from 'node:crypto';
import { env } from '../../config/env.js';
import { HttpError } from '../../utils/http-error.js';
import { courseService } from '../courses/courses.service.js';
import { isPlatformAdmin, requireRole } from '../permissions/policy.js';
import { prismaUploadRepository, type UploadRepository } from './uploads.repository.js';
import type { PresignInput } from './uploads.schema.js';
import { storage as defaultStorage, type StorageProvider } from './uploads.storage.js';
import { consumeTicket, verifyUploadTicket, type UploadTicket } from './uploads.ticket.js';
import { EXT_TO_TYPE, IMAGE_TYPES, KEY_PATTERN, purposeRule, type UploadRecord } from './uploads.types.js';

const MB = 1024 * 1024;
const baseType = (ct: string) => ct.split(';')[0]!.trim().toLowerCase();

/** Kiểm tra vài byte đầu (magic bytes) khớp contentType khai báo — chặn file giả mạo (vd. HTML đổi đuôi .png). */
export function matchesMagic(contentType: string, b: Buffer): boolean {
  const starts = (sig: number[], off = 0) => b.length >= off + sig.length && sig.every((v, i) => b[off + i] === v);
  switch (contentType) {
    case 'image/jpeg':
      return starts([0xff, 0xd8, 0xff]);
    case 'image/png':
      return starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case 'image/gif':
      return starts([0x47, 0x49, 0x46, 0x38]);
    case 'image/webp':
      return starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8);
    case 'application/pdf':
      return starts([0x25, 0x50, 0x44, 0x46]);
    case 'application/zip':
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
      return starts([0x50, 0x4b]);
    case 'video/mp4':
      return starts([0x66, 0x74, 0x79, 0x70], 4);
    case 'text/plain':
      return !b.includes(0); // văn bản thuần không chứa byte NUL
    default:
      return false;
  }
}

export function createUploadService(repo: UploadRepository = prismaUploadRepository, storage: StorageProvider = defaultStorage) {
  const usedBytes = (userId: string) => repo.usedBytes(userId, env.UPLOAD_TICKET_TTL_SEC * 1000);

  return {
    async presign(userId: string, input: PresignInput) {
      const contentType = baseType(input.contentType);
      const rule = purposeRule(input.purpose);
      const ext = rule.types[contentType];
      if (!ext) throw HttpError.badRequest('Loại file này không được phép tải lên cho mục đích đã chọn');
      if (input.size > rule.maxBytes) {
        throw HttpError.badRequest(`File quá lớn, tối đa ${Math.round((rule.maxBytes / MB) * 10) / 10}MB cho mục đích này`);
      }
      if (input.purpose === 'lesson_attachment' && input.courseId) {
        await courseService.getById(input.courseId); // 404 nếu khóa học không tồn tại
        await requireRole(userId, input.courseId, 'mod');
      }
      if ((await usedBytes(userId)) + input.size > env.UPLOAD_USER_QUOTA_MB * MB) {
        throw new HttpError(413, 'QUOTA_EXCEEDED', `Bạn đã vượt hạn mức lưu trữ ${env.UPLOAD_USER_QUOTA_MB}MB, hãy xóa bớt file cũ`);
      }

      // Khóa ngẫu nhiên, KHÔNG dùng tên file người dùng làm đường dẫn; chỉ giữ đuôi đã whitelist.
      const key = `${randomBytes(16).toString('hex')}.${ext}`;
      const rec: UploadRecord = {
        key,
        ownerId: userId,
        filename: input.filename.replace(/[\u0000-\u001f\u007f/\\"]/g, '_'),
        contentType,
        size: input.size,
        purpose: input.purpose,
        // Chỉ lesson_attachment được kiểm tra khóa học tồn tại; mục đích khác không lưu courseId (tránh vi phạm FK).
        courseId: input.purpose === 'lesson_attachment' ? input.courseId : undefined,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      await repo.create(rec);
      const target = storage.createUploadTarget({ key, contentType, maxSize: input.size, userId });
      return { ...target, fileUrl: storage.publicUrl(key), key };
    },

    /** Bước 1 của PUT: xác thực vé + ràng buộc; nếu đạt thì đánh dấu vé đã dùng (dùng 1 lần). */
    async authorizePut(key: string, token: string | undefined, contentTypeHeader: string | undefined, contentLength: number | undefined) {
      const check = token ? verifyUploadTicket(token) : ({ ok: false, reason: 'invalid' } as const);
      if (!check.ok) {
        const msg = { invalid: 'Vé upload không hợp lệ', expired: 'Vé upload đã hết hạn', used: 'Vé upload đã được sử dụng' }[check.reason];
        throw HttpError.unauthorized(msg);
      }
      const t = check.ticket;
      if (t.k !== key || !KEY_PATTERN.test(key)) throw HttpError.forbidden('Vé upload không khớp với file');
      const rec = await repo.get(key);
      if (!rec || rec.status !== 'pending' || rec.ownerId !== t.u) throw HttpError.notFound('Không tìm thấy yêu cầu upload');
      if (!contentTypeHeader || baseType(contentTypeHeader) !== t.ct) throw HttpError.badRequest('Content-Type không khớp với vé upload');
      if (contentLength !== undefined && contentLength > t.ms) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'File vượt quá dung lượng đã khai báo');
      consumeTicket(t);
      return { ticket: t, record: rec };
    },

    /** Bước 2 của PUT: có toàn bộ body rồi mới kiểm tra magic bytes + ghi. Lỗi thì hủy yêu cầu upload. */
    async completePut(ticket: UploadTicket, record: UploadRecord, data: Buffer) {
      try {
        if (data.length === 0) throw HttpError.badRequest('File rỗng');
        if (data.length > ticket.ms) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'File vượt quá dung lượng đã khai báo');
        if (!matchesMagic(ticket.ct, data)) throw HttpError.badRequest('Nội dung file không khớp với loại file khai báo');
        await storage.put(record.key, data, { contentType: ticket.ct });
        await repo.update(record.key, { status: 'uploaded', size: data.length });
      } catch (e) {
        await repo.delete(record.key);
        throw e;
      }
      return { key: record.key, fileUrl: storage.publicUrl(record.key), size: data.length, contentType: ticket.ct };
    },

    /** Mở file để phục vụ; contentType suy từ đuôi (đã whitelist), không tin tên file người dùng. */
    async open(key: string, opts: { includeRemoved?: boolean } = {}) {
      if (!KEY_PATTERN.test(key)) return null;
      const contentType = EXT_TO_TYPE[key.split('.')[1]!];
      if (!contentType) return null;
      const rec = await repo.get(key);
      if (rec?.removed && !opts.includeRemoved) return null; // file bị admin gỡ: chỉ admin tải được
      const f = await storage.getStream(key);
      if (!f) return null;
      return { ...f, contentType, isImage: contentType in IMAGE_TYPES, filename: rec?.filename ?? key };
    },

    async listMine(userId: string) {
      const list = (await repo.listByUser(userId)).filter((r) => r.status === 'uploaded' && !r.removed);
      return list.map((r) => ({
        key: r.key,
        url: storage.publicUrl(r.key),
        filename: r.filename,
        contentType: r.contentType,
        size: r.size,
        purpose: r.purpose,
        createdAt: r.createdAt,
      }));
    },

    /** Xóa file: chỉ chủ sở hữu hoặc Platform Admin. */
    async remove(userId: string, key: string) {
      const rec = KEY_PATTERN.test(key) ? await repo.get(key) : undefined;
      if (!rec) throw HttpError.notFound('Không tìm thấy file');
      if (rec.ownerId !== userId && !(await isPlatformAdmin(userId))) throw HttpError.forbidden('Bạn không có quyền xóa file này');
      await storage.delete(key);
      await repo.delete(key);
    },

    /** Cho module khác (tin nhắn...) xác nhận 1 key là file đã upload xong. */
    async getUploaded(key: string): Promise<UploadRecord | undefined> {
      if (!KEY_PATTERN.test(key)) return undefined;
      const rec = await repo.get(key);
      return rec?.status === 'uploaded' && !rec.removed ? rec : undefined;
    },
  };
}

export const uploadService = createUploadService();

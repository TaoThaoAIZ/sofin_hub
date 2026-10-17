import { randomBytes } from 'node:crypto';
import { Transform, pipeline, type Readable } from 'node:stream';
import { env } from '../../config/env.js';
import { HttpError } from '../../utils/http-error.js';
import { catalogService } from '../catalog/catalog.service.js';
import { isPlatformAdmin, requireRole } from '../permissions/policy.js';
import { prismaUploadRepository, type UploadRepository } from './uploads.repository.js';
import type { CompleteInput, PresignInput } from './uploads.schema.js';
import { storage as defaultStorage, type ByteRange, type StorageProvider } from './uploads.storage.js';
import { consumeTicket, isTicketUsed, verifyUploadTicket, type UploadTicket } from './uploads.ticket.js';
import { isReferencedByLiveMessage } from './uploads.access.js';
import { EXT_TO_TYPE, FILE_URL_PREFIX, IMAGE_TYPES, KEY_PATTERN, isCommunityPurpose, isStreamedPurpose, purposeRule, type UploadRecord } from './uploads.types.js';

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
    case 'application/vnd.openxmlformats-officedocument.presentationml.slideshow':
      return starts([0x50, 0x4b]);
    case 'application/msword':
    case 'application/vnd.ms-powerpoint':
    case 'application/vnd.ms-excel':
      return starts([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]); // OLE2 compound file
    case 'video/mp4':
    case 'video/quicktime':
      return starts([0x66, 0x74, 0x79, 0x70], 4); // "ftyp"
    case 'video/webm':
      return starts([0x1a, 0x45, 0xdf, 0xa3]); // EBML
    case 'text/plain':
    case 'text/csv':
      return !b.includes(0); // văn bản thuần không chứa byte NUL
    default:
      return false;
  }
}

export function createUploadService(repo: UploadRepository = prismaUploadRepository, storage: StorageProvider = defaultStorage) {
  /** Kích thước thật của file (để tính Range) mà không mở stream. */
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
      if (isCommunityPurpose(input.purpose)) {
        // Video/slide phục vụ theo quyền thành viên của cộng đồng nên BẮT BUỘC gắn cộng đồng; lesson_attachment cũ vẫn cho phép thiếu.
        if (!input.communityId && input.purpose !== 'lesson_attachment') throw HttpError.badRequest('Thiếu cộng đồng cho file bài học');
        if (input.communityId) {
          await catalogService.getById(input.communityId); // 404 nếu khóa học không tồn tại
          await requireRole(userId, input.communityId, 'mod');
        }
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
        // Chỉ file bài học được kiểm tra cộng đồng tồn tại; mục đích khác không lưu communityId (tránh vi phạm FK).
        communityId: isCommunityPurpose(input.purpose) ? input.communityId : undefined,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      await repo.create(rec);
      if (storage.direct) {
        // S3: trình duyệt PUT thẳng lên S3 (không qua backend); sau đó gọi POST /uploads/:key/complete để backend xác nhận.
        try {
          const plan = await storage.direct.plan({ key, contentType, size: input.size });
          return {
            mode: 'direct' as const,
            uploadUrl: plan.uploadUrl,
            method: 'PUT' as const,
            headers: plan.headers,
            expiresAt: plan.expiresAt,
            multipart: plan.multipart,
            fileUrl: storage.publicUrl(key),
            key,
          };
        } catch (e) {
          await repo.delete(key);
          throw e;
        }
      }
      const target = storage.createUploadTarget({ key, contentType, maxSize: input.size, userId });
      return { mode: 'proxy' as const, ...target, fileUrl: storage.publicUrl(key), key };
    },

    /**
     * Bước xác nhận của luồng upload trực tiếp S3: ghép multipart (nếu có), kiểm dung lượng thật = đã khai báo, kiểm magic bytes ở khúc đầu.
     * Sai thì xóa object + bản ghi (không bao giờ phục vụ file chưa kiểm).
     */
    async completeDirect(userId: string, key: string, input: CompleteInput) {
      const direct = storage.direct;
      const rec = KEY_PATTERN.test(key) ? await repo.get(key) : undefined;
      if (!direct || !rec || rec.ownerId !== userId || rec.status !== 'pending') throw HttpError.notFound('Không tìm thấy yêu cầu upload');
      const discard = async () => {
        if (input.uploadId) await direct.abortMultipart(key, input.uploadId);
        await storage.delete(key).catch(() => undefined);
        await repo.delete(key);
      };
      const t0 = Date.now();
      const step = (name: string) => console.info(`[uploads] complete ${key} ${name} +${Date.now() - t0}ms`);
      try {
        if (input.uploadId) {
          if (!input.parts?.length) throw HttpError.badRequest('Thiếu danh sách phần đã tải lên');
          await direct.completeMultipart(key, input.uploadId, input.parts);
          step('đã ghép phần');
        }
        const size = await direct.head(key);
        step(`head size=${size}`);
        if (size === null) throw HttpError.badRequest('File chưa được tải lên kho lưu trữ');
        if (size === 0) throw HttpError.badRequest('File rỗng');
        if (size !== rec.size) throw HttpError.badRequest('Dung lượng file tải lên không khớp với khai báo');
        if (!matchesMagic(rec.contentType, await direct.readHead(key, 64))) throw HttpError.badRequest('Nội dung file không khớp với loại file khai báo');
        step('đã kiểm magic bytes');
      } catch (e) {
        console.error(`[uploads] complete ${key} lỗi +${Date.now() - t0}ms:`, e instanceof Error ? `${e.name}: ${e.message}` : e);
        await discard();
        throw e;
      }
      await repo.update(key, { status: 'uploaded', size: rec.size });
      return { key, fileUrl: storage.publicUrl(key), size: rec.size, contentType: rec.contentType };
    },

    /** Hủy upload trực tiếp đang dở (FE gọi khi lỗi/hủy): dọn phần multipart + bản ghi pending của chính chủ. */
    async abortDirect(userId: string, key: string, uploadId?: string) {
      const rec = KEY_PATTERN.test(key) ? await repo.get(key) : undefined;
      if (!rec || rec.ownerId !== userId || rec.status !== 'pending') return;
      if (uploadId) await storage.direct?.abortMultipart(key, uploadId);
      await repo.delete(key);
    },

    /** Bước 1 của PUT: xác thực vé + ràng buộc; nếu đạt thì đánh dấu vé đã dùng (dùng 1 lần). */
    async authorizePut(key: string, token: string | undefined, contentTypeHeader: string | undefined, contentLength: number | undefined) {
      const check = token ? verifyUploadTicket(token) : ({ ok: false, reason: 'invalid' } as const);
      if (!check.ok) {
        const msg = { invalid: 'Vé upload không hợp lệ', expired: 'Vé upload đã hết hạn', used: 'Vé upload đã được sử dụng' }[check.reason];
        throw HttpError.unauthorized(msg);
      }
      const t = check.ticket;
      if (await isTicketUsed(t)) throw HttpError.unauthorized('Vé upload đã được sử dụng');
      if (t.k !== key || !KEY_PATTERN.test(key)) throw HttpError.forbidden('Vé upload không khớp với file');
      const rec = await repo.get(key);
      if (!rec || rec.status !== 'pending' || rec.ownerId !== t.u) throw HttpError.notFound('Không tìm thấy yêu cầu upload');
      if (!contentTypeHeader || baseType(contentTypeHeader) !== t.ct) throw HttpError.badRequest('Content-Type không khớp với vé upload');
      if (contentLength !== undefined && contentLength > t.ms) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'File vượt quá dung lượng đã khai báo');
      // Atomic cuối cùng: hai PUT đua nhau cùng vé chỉ một bên qua được (replay bị chặn kể cả giữa các instance).
      if (!(await consumeTicket(t))) throw HttpError.unauthorized('Vé upload đã được sử dụng');
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

    /**
     * Bước 2 (dạng STREAM) cho video/slide lớn: kiểm magic bytes ở khúc đầu, đếm byte (vượt vé hoặc lệch Content-Length thì hủy),
     * ghi thẳng xuống kho không qua RAM. Lỗi thì hủy yêu cầu upload và dọn file dở.
     */
    async completeStream(ticket: UploadTicket, record: UploadRecord, body: Readable, contentLength: number) {
      let seen = 0;
      let head = Buffer.alloc(0);
      let checked = false;
      const guard = new Transform({
        transform(chunk: Buffer, _enc, cb) {
          seen += chunk.length;
          if (seen > ticket.ms) return cb(new HttpError(413, 'PAYLOAD_TOO_LARGE', 'File vượt quá dung lượng đã khai báo'));
          if (!checked) {
            head = Buffer.concat([head, chunk]).subarray(0, 64);
            if (head.length >= 12 || seen >= contentLength) {
              if (!matchesMagic(ticket.ct, head)) return cb(HttpError.badRequest('Nội dung file không khớp với loại file khai báo'));
              checked = true;
            }
          }
          cb(null, chunk);
        },
        flush(cb) {
          if (seen === 0) return cb(HttpError.badRequest('File rỗng'));
          if (seen !== contentLength) return cb(HttpError.badRequest('Dữ liệu nhận được không khớp Content-Length (tải lên bị gián đoạn)'));
          if (!checked && !matchesMagic(ticket.ct, head)) return cb(HttpError.badRequest('Nội dung file không khớp với loại file khai báo'));
          cb();
        },
      });
      try {
        // pipeline (không dùng .pipe): lỗi của guard/request được truyền sang guard để storage.putStream thấy và dọn dẹp, không phát sinh uncaughtException.
        pipeline(body, guard, () => undefined);
        await storage.putStream(record.key, guard, { contentType: ticket.ct, size: contentLength });
        await repo.update(record.key, { status: 'uploaded', size: seen });
      } catch (e) {
        await storage.delete(record.key).catch(() => undefined);
        await repo.delete(record.key);
        throw e;
      }
      return { key: record.key, fileUrl: storage.publicUrl(record.key), size: seen, contentType: ticket.ct };
    },

    /** Mở file để phục vụ; contentType suy từ đuôi (đã whitelist), không tin tên file người dùng. `range` = Range request (video tua được). */
    async open(key: string, opts: { includeRemoved?: boolean; range?: ByteRange } = {}) {
      if (!KEY_PATTERN.test(key)) return null;
      const contentType = EXT_TO_TYPE[key.split('.')[1]!];
      if (!contentType) return null;
      const rec = await repo.get(key);
      // Không có bản ghi Upload (hoặc chưa PUT xong) thì KHÔNG phục vụ, dù file có tồn tại trên đĩa.
      if (!rec || rec.status !== 'uploaded') return null;
      if (rec.removed && !opts.includeRemoved) return null; // file bị admin gỡ: chỉ admin tải được
      const f = await storage.getStream(key, opts.range);
      if (!f) return null;
      return { ...f, contentType, isImage: contentType in IMAGE_TYPES, filename: rec.filename, record: rec };
    },

    /**
     * Video bài học trên S3: trả URL presigned GET để trình duyệt tải thẳng từ S3 (tua/đệm nhanh, không qua backend + không kiểm quyền DB
     * ở từng Range). Gọi SAU khi đã kiểm quyền. null = không áp dụng (đĩa local / loại file khác) -> dùng URL ký qua backend.
     */
    async directReadUrl(rec: UploadRecord, ttlSec: number): Promise<{ url: string; expiresAt: string } | null> {
      if (!storage.signedReadUrl || rec.purpose !== 'lesson_video') return null;
      const url = await storage.signedReadUrl(rec.key, { ttlSec, contentType: rec.contentType });
      return { url, expiresAt: new Date(Date.now() + ttlSec * 1000).toISOString() };
    },

    /** Bản ghi của file đã upload xong và chưa bị gỡ; undefined nếu không phục vụ được. */
    async getServable(key: string): Promise<UploadRecord | undefined> {
      if (!KEY_PATTERN.test(key)) return undefined;
      const rec = await repo.get(key);
      return rec?.status === 'uploaded' && !rec.removed ? rec : undefined;
    },

    /** Tin nhắn bị thu hồi: xóa file đính kèm (đĩa + bản ghi) nếu không còn tin nhắn sống nào dùng lại nó. */
    async discardMessageFiles(urls: string[]) {
      for (const url of urls) {
        if (!url.startsWith(FILE_URL_PREFIX)) continue;
        const key = url.slice(FILE_URL_PREFIX.length);
        const rec = KEY_PATTERN.test(key) ? await repo.get(key) : undefined;
        if (!rec || rec.purpose !== 'message_attachment') continue;
        if (await isReferencedByLiveMessage(key)) continue;
        await storage.delete(key);
        await repo.delete(key);
      }
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

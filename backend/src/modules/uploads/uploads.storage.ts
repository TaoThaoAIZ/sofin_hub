import { webKeyOf } from './video-optimize.js';
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';
import { env } from '../../config/env.js';
import { HttpError } from '../../utils/http-error.js';
import { signUploadTicket } from './uploads.ticket.js';
import { FILE_URL_PREFIX, KEY_PATTERN } from './uploads.types.js';

export interface UploadTarget {
  uploadUrl: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresAt: string;
}

/**
 * Trừu tượng hóa nơi lưu file. Hiện dùng LocalDiskStorage; sau này đổi sang S3/MinIO chỉ cần hiện thực interface này
 * (createUploadTarget trả presigned PUT của S3, put/getStream/delete gọi SDK) — xem docs/api/uploads.md.
 */
/** Khoảng byte (đã bao gồm đầu mút) cho Range request. */
export interface ByteRange {
  start: number;
  end: number;
}
export interface StoredStream {
  stream: Readable;
  /** TỔNG dung lượng file (không phải độ dài đoạn trả về). */
  size: number;
}

/** Kế hoạch upload TRỰC TIẾP từ trình duyệt lên kho (S3): một PUT presigned, hoặc multipart (chia phần, upload song song). */
export interface DirectUploadPlan {
  headers: Record<string, string>;
  expiresAt: string;
  /** PUT một lần (file nhỏ). */
  uploadUrl?: string;
  /** Multipart (file lớn): FE PUT từng phần `partSize` byte vào `partUrls[i]` rồi gửi ETag từng phần ở bước complete. */
  multipart?: { uploadId: string; partSize: number; partUrls: string[] };
}
export interface CompletedPart {
  partNumber: number;
  etag: string;
}
export interface DirectUpload {
  plan(input: { key: string; contentType: string; size: number }): Promise<DirectUploadPlan>;
  /** Ghép các phần (multipart). PUT đơn không cần gọi. */
  completeMultipart(key: string, uploadId: string, parts: CompletedPart[]): Promise<void>;
  abortMultipart(key: string, uploadId: string): Promise<void>;
  /** Dung lượng object trên kho; null nếu chưa có. */
  head(key: string): Promise<number | null>;
  /** Đọc `bytes` byte đầu (kiểm magic bytes). */
  readHead(key: string, bytes: number): Promise<Buffer>;
}

export interface StorageProvider {
  /**
   * URL đọc trực tiếp từ kho (S3 presigned GET, hỗ trợ Range): trình duyệt tải thẳng, không đi qua backend. Dùng cho video lớn.
   * Không có (đĩa local) = phục vụ qua GET /files/:key.
   */
  signedReadUrl?(key: string, opts: { ttlSec: number; contentType: string; /** Đọc bản web (web/<khóa>.mp4) thay vì file gốc. */ web?: boolean }): Promise<string>;
  /** Có = trình duyệt upload thẳng lên kho (không đi qua backend). Không có (đĩa local) = luồng vé HMAC qua backend. */
  direct?: DirectUpload;
  createUploadTarget(input: { key: string; contentType: string; maxSize: number; userId: string }): UploadTarget;
  put(key: string, data: Buffer, meta: { contentType: string }): Promise<void>;
  /** Ghi file từ stream (video dài/slide lớn) không nạp vào RAM. `size` = đúng số byte sẽ nhận. Lỗi giữa chừng thì dọn file dở. */
  putStream(key: string, stream: Readable, meta: { contentType: string; size: number }): Promise<void>;
  getStream(key: string, range?: ByteRange): Promise<StoredStream | null>;
  delete(key: string): Promise<void>;
  publicUrl(key: string): string;
}

/** Chặn path traversal ở tầng storage: chỉ nhận đúng định dạng key do hệ thống sinh. */
function assertKey(key: string): void {
  if (!KEY_PATTERN.test(key)) throw HttpError.badRequest('Khóa file không hợp lệ');
}

export class LocalDiskStorage implements StorageProvider {
  private readonly root: string;

  constructor(dir: string = env.UPLOAD_DIR) {
    this.root = isAbsolute(dir) ? dir : resolve(process.cwd(), dir);
  }

  private path(key: string): string {
    assertKey(key);
    return join(this.root, key);
  }

  createUploadTarget({ key, contentType, maxSize, userId }: { key: string; contentType: string; maxSize: number; userId: string }): UploadTarget {
    const { token, expiresAt } = signUploadTicket({ key, contentType, maxSize, userId });
    return {
      uploadUrl: `/api/uploads/${key}?token=${encodeURIComponent(token)}`,
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      expiresAt,
    };
  }

  async put(key: string, data: Buffer): Promise<void> {
    const target = this.path(key);
    await mkdir(this.root, { recursive: true });
    // Ghi ra file tạm rồi đổi tên để không bao giờ phục vụ file ghi dở.
    const tmp = `${target}.part`;
    await writeFile(tmp, data);
    await rename(tmp, target);
  }

  async putStream(key: string, stream: Readable): Promise<void> {
    const target = this.path(key);
    await mkdir(this.root, { recursive: true });
    const tmp = `${target}.part`;
    try {
      await pipeline(stream, createWriteStream(tmp));
      await rename(tmp, target);
    } catch (e) {
      await unlink(tmp).catch(() => undefined);
      throw e;
    }
  }

  async getStream(key: string, range?: ByteRange) {
    let target: string;
    try {
      target = this.path(key);
    } catch {
      return null;
    }
    try {
      const s = await stat(target);
      if (!s.isFile()) return null;
      return { stream: createReadStream(target, range ? { start: range.start, end: range.end } : undefined), size: s.size };
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    await unlink(this.path(key)).catch(() => undefined);
  }

  publicUrl(key: string): string {
    return `${FILE_URL_PREFIX}${key}`;
  }
}

/**
 * Lưu file ở S3 (bucket private). Giữ nguyên luồng hiện tại: FE vẫn PUT lên backend bằng vé HMAC, backend kiểm magic bytes + quota
 * rồi mới ghi lên S3; mọi lần GET đều đi qua backend để kiểm quyền (bucket không bao giờ công khai, không cần CORS bucket).
 * File tối đa vài chục MB nên việc backend làm trung gian chấp nhận được.
 */
/** Phần multipart: S3 yêu cầu ≥ 5MB (trừ phần cuối). 16MB cho video 2GB = 128 phần (giới hạn S3 là 10.000). */
export const MULTIPART_PART_SIZE = 16 * 1024 * 1024;
/** File từ ngưỡng này trở lên dùng multipart; nhỏ hơn dùng một presigned PUT. */
export const MULTIPART_THRESHOLD = 32 * 1024 * 1024;
/** URL presigned sống đủ lâu cho video lớn trên mạng chậm (bị giới hạn thêm bởi thời hạn credential IAM role). */
const DIRECT_URL_TTL_SEC = 2 * 3600;

export class S3Storage implements StorageProvider {
  constructor(
    private readonly bucket: string,
    private readonly client: Pick<S3Client, 'send'> = new S3Client({
      region: env.S3_REGION,
      // Không để một lệnh S3 treo vô hạn (trình duyệt sẽ đứng ở bước /complete): nối kết tối đa 5s, im lặng quá 2 phút thì hủy và thử lại.
      requestHandler: { connectionTimeout: 5_000, requestTimeout: 120_000 },
      maxAttempts: 3,
      // SDK mới mặc định thêm checksum CRC32 vào mọi request/URL presigned: URL PUT của trình duyệt bị lệch checksum; chỉ tính khi S3 bắt buộc.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    }),
    /** Ký URL: mặc định dùng presigner của SDK; test truyền bản giả. */
    private readonly sign: (cmd: object, ttlSec: number) => Promise<string> = (cmd, ttlSec) => getSignedUrl(client as S3Client, cmd as never, { expiresIn: ttlSec }),
  ) {}

  signedReadUrl = (key: string, opts: { ttlSec: number; contentType: string; web?: boolean }): Promise<string> => {
    assertKey(key);
    return this.sign(
      new GetObjectCommand({ Bucket: this.bucket, Key: opts.web ? webKeyOf(key) : key, ResponseContentType: opts.web ? 'video/mp4' : opts.contentType, ResponseCacheControl: 'private, max-age=3600' }),
      opts.ttlSec,
    );
  };

  readonly direct: DirectUpload = {
    plan: async ({ key, contentType, size }) => {
      assertKey(key);
      const expiresAt = new Date(Date.now() + DIRECT_URL_TTL_SEC * 1000).toISOString();
      const headers = { 'Content-Type': contentType };
      if (size < MULTIPART_THRESHOLD) {
        const uploadUrl = await this.sign(new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }), DIRECT_URL_TTL_SEC);
        return { headers, expiresAt, uploadUrl };
      }
      const created = await this.client.send(new CreateMultipartUploadCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }));
      const uploadId = created.UploadId;
      if (!uploadId) throw new Error('S3 không trả UploadId');
      const count = Math.ceil(size / MULTIPART_PART_SIZE);
      const partUrls = await Promise.all(
        Array.from({ length: count }, (_, i) => this.sign(new UploadPartCommand({ Bucket: this.bucket, Key: key, UploadId: uploadId, PartNumber: i + 1 }), DIRECT_URL_TTL_SEC)),
      );
      return { headers, expiresAt, multipart: { uploadId, partSize: MULTIPART_PART_SIZE, partUrls } };
    },
    completeMultipart: async (key, uploadId, parts) => {
      assertKey(key);
      const sorted = [...parts].sort((a, b) => a.partNumber - b.partNumber).map((p) => ({ PartNumber: p.partNumber, ETag: p.etag }));
      await this.client.send(new CompleteMultipartUploadCommand({ Bucket: this.bucket, Key: key, UploadId: uploadId, MultipartUpload: { Parts: sorted } }));
    },
    abortMultipart: async (key, uploadId) => {
      assertKey(key);
      await this.client.send(new AbortMultipartUploadCommand({ Bucket: this.bucket, Key: key, UploadId: uploadId })).catch(() => undefined);
    },
    head: async (key) => {
      assertKey(key);
      try {
        const out = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
        return out.ContentLength ?? 0;
      } catch (e) {
        const name = (e as { name?: string }).name;
        if (name === 'NotFound' || name === 'NoSuchKey') return null;
        throw e;
      }
    },
    readHead: async (key, bytes) => {
      assertKey(key);
      const out = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key, Range: `bytes=0-${bytes - 1}` }));
      // transformToByteArray đọc hết + đóng socket đúng cách (tránh socket treo khi chỉ đọc đầu file).
      const body = out.Body as { transformToByteArray?: () => Promise<Uint8Array> } & Readable;
      if (typeof body.transformToByteArray === 'function') return Buffer.from(await body.transformToByteArray());
      const chunks: Buffer[] = [];
      for await (const c of body) chunks.push(Buffer.from(c as Buffer));
      return Buffer.concat(chunks);
    },
  };

  createUploadTarget({ key, contentType, maxSize, userId }: { key: string; contentType: string; maxSize: number; userId: string }): UploadTarget {
    assertKey(key);
    const { token, expiresAt } = signUploadTicket({ key, contentType, maxSize, userId });
    return {
      uploadUrl: `/api/uploads/${key}?token=${encodeURIComponent(token)}`,
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      expiresAt,
    };
  }

  async put(key: string, data: Buffer, meta: { contentType: string }): Promise<void> {
    assertKey(key);
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: data, ContentType: meta.contentType }));
  }

  async putStream(key: string, stream: Readable, meta: { contentType: string; size: number }): Promise<void> {
    assertKey(key);
    // Hứng toàn bộ file xuống đĩa tạm TRƯỚC rồi mới đẩy lên S3 từ đĩa. Nếu truyền thẳng luồng của người dùng sang S3, người dùng mạng chậm
    // làm S3 chờ dữ liệu quá lâu -> S3 đóng socket ("non-retryable streaming request") và request treo vô hạn ở phía trình duyệt.
    // Cách này cũng đảm bảo lỗi kiểm tra (sai magic bytes, thiếu byte) xảy ra trước khi chạm S3, không bao giờ có object dở dang.
    const tmp = join(tmpdir(), `upload-${randomUUID()}.part`);
    try {
      await pipeline(stream, createWriteStream(tmp));
      await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: createReadStream(tmp), ContentLength: meta.size, ContentType: meta.contentType }));
    } finally {
      await unlink(tmp).catch(() => undefined);
    }
  }

  async getStream(key: string, range?: ByteRange) {
    try {
      assertKey(key);
    } catch {
      return null;
    }
    try {
      const out = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key, ...(range ? { Range: `bytes=${range.start}-${range.end}` } : {}) }));
      if (!out.Body) return null;
      // Có Range thì ContentLength là độ dài ĐOẠN; tổng dung lượng nằm ở ContentRange ("bytes a-b/total").
      const total = range ? Number(/\/(\d+)$/.exec(out.ContentRange ?? '')?.[1] ?? 0) : (out.ContentLength ?? 0);
      return { stream: out.Body as Readable, size: total };
    } catch (e) {
      // Chỉ "không có object" mới là 404; lỗi quyền/mạng phải nổi lên (500) để không che sự cố cấu hình IAM.
      const name = (e as { name?: string }).name;
      if (name === 'NoSuchKey' || name === 'NotFound') return null;
      throw e;
    }
  }

  async delete(key: string): Promise<void> {
    assertKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  publicUrl(key: string): string {
    return `${FILE_URL_PREFIX}${key}`;
  }
}

export const storage: StorageProvider = env.S3_BUCKET ? new S3Storage(env.S3_BUCKET) : new LocalDiskStorage();

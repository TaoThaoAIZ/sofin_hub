import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createReadStream } from 'node:fs';
import { mkdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
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
export interface StorageProvider {
  createUploadTarget(input: { key: string; contentType: string; maxSize: number; userId: string }): UploadTarget;
  put(key: string, data: Buffer, meta: { contentType: string }): Promise<void>;
  getStream(key: string): Promise<{ stream: Readable; size: number } | null>;
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

  async getStream(key: string) {
    let target: string;
    try {
      target = this.path(key);
    } catch {
      return null;
    }
    try {
      const s = await stat(target);
      if (!s.isFile()) return null;
      return { stream: createReadStream(target), size: s.size };
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
export class S3Storage implements StorageProvider {
  constructor(
    private readonly bucket: string,
    private readonly client: Pick<S3Client, 'send'> = new S3Client({ region: env.S3_REGION }),
  ) {}

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

  async getStream(key: string) {
    try {
      assertKey(key);
    } catch {
      return null;
    }
    try {
      const out = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      if (!out.Body) return null;
      return { stream: out.Body as Readable, size: out.ContentLength ?? 0 };
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

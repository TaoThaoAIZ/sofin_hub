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

/** Khung cho S3/MinIO — chưa cấu hình nên mọi thao tác đều báo lỗi rõ ràng (không cài aws-sdk). */
export class S3Storage implements StorageProvider {
  private fail(): never {
    throw new Error('S3Storage chưa được cấu hình (xem docs/api/uploads.md mục "Nối S3/MinIO")');
  }
  createUploadTarget(): UploadTarget {
    return this.fail();
  }
  async put(): Promise<void> {
    this.fail();
  }
  async getStream(): Promise<never> {
    return this.fail();
  }
  async delete(): Promise<void> {
    this.fail();
  }
  publicUrl(): string {
    return this.fail();
  }
}

export const storage: StorageProvider = new LocalDiskStorage();

import { prisma } from '../../db/prisma.js';
import type { Upload } from '../../generated/prisma/client.js';
import type { UploadRecord } from './uploads.types.js';

/** Metadata file trên Postgres (bảng Upload; PK = key). Nội dung file vẫn nằm ở StorageProvider (đĩa/S3). */
export interface UploadRepository {
  create(rec: UploadRecord): Promise<void>;
  get(key: string): Promise<UploadRecord | undefined>;
  update(key: string, patch: Partial<UploadRecord>): Promise<void>;
  delete(key: string): Promise<void>;
  /** Mới nhất trước. */
  listByUser(userId: string): Promise<UploadRecord[]>;
  /**
   * Dung lượng user đang chiếm = SUM(size) của file đã upload + file còn "pending" tạo trong vòng `pendingTtlMs`
   * (chỗ đã giữ nhưng chưa PUT). Tính bằng 1 truy vấn SUM, không kéo danh sách về bộ nhớ.
   */
  usedBytes(userId: string, pendingTtlMs: number): Promise<number>;
}

const toDomain = (u: Upload): UploadRecord => ({
  key: u.key,
  ownerId: u.ownerId,
  filename: u.filename,
  contentType: u.contentType,
  size: u.size,
  purpose: u.purpose,
  ...(u.courseId ? { courseId: u.courseId } : {}),
  status: u.status,
  createdAt: u.createdAt.toISOString(),
});

export const prismaUploadRepository: UploadRepository = {
  async create(rec) {
    await prisma.upload.create({
      data: {
        key: rec.key,
        ownerId: rec.ownerId,
        filename: rec.filename,
        contentType: rec.contentType,
        size: rec.size,
        purpose: rec.purpose,
        courseId: rec.courseId ?? null,
        status: rec.status,
        createdAt: new Date(rec.createdAt),
      },
    });
  },

  async get(key) {
    const u = await prisma.upload.findUnique({ where: { key } });
    return u ? toDomain(u) : undefined;
  },

  async update(key, patch) {
    await prisma.upload.updateMany({
      where: { key },
      data: {
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.size !== undefined ? { size: patch.size } : {}),
        ...(patch.filename !== undefined ? { filename: patch.filename } : {}),
        ...(patch.contentType !== undefined ? { contentType: patch.contentType } : {}),
      },
    });
  },

  async delete(key) {
    await prisma.upload.deleteMany({ where: { key } });
  },

  async listByUser(userId) {
    const rows = await prisma.upload.findMany({ where: { ownerId: userId }, orderBy: [{ createdAt: 'desc' }, { key: 'desc' }] });
    return rows.map(toDomain);
  },

  async usedBytes(userId, pendingTtlMs) {
    const agg = await prisma.upload.aggregate({
      _sum: { size: true },
      where: {
        ownerId: userId,
        OR: [{ status: 'uploaded' }, { createdAt: { gt: new Date(Date.now() - pendingTtlMs) } }],
      },
    });
    return agg._sum.size ?? 0;
  },
};

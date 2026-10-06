import { z } from 'zod';

/** Chỉ nhận http(s): chặn javascript:, data:, file:... (chống XSS khi FE gắn vào href/src). */
export function parseHttpUrl(raw: string): URL | null {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u : null;
  } catch {
    return null;
  }
}

const YT_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com']);
const VIMEO_HOSTS = new Set(['vimeo.com', 'www.vimeo.com', 'player.vimeo.com']);
const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^\d{5,12}$/;

/**
 * Chuẩn hóa link YouTube/Vimeo thành URL nhúng an toàn; null nếu host lạ / sai định dạng.
 * Luôn dựng lại URL từ ID đã kiểm tra, không dùng nguyên chuỗi người dùng nhập (chống redirect/XSS).
 */
export function toEmbedUrl(raw: string): string | null {
  const u = parseHttpUrl(raw.trim());
  if (!u) return null;
  const host = u.hostname.toLowerCase();
  const parts = u.pathname.split('/').filter(Boolean);

  if (host === 'youtu.be') {
    return parts[0] && YT_ID.test(parts[0]) ? `https://www.youtube.com/embed/${parts[0]}` : null;
  }
  if (YT_HOSTS.has(host)) {
    let id: string | undefined;
    if (parts[0] === 'watch') id = u.searchParams.get('v') ?? undefined;
    else if (['embed', 'shorts', 'live', 'v'].includes(parts[0] ?? '')) id = parts[1];
    return id && YT_ID.test(id) ? `https://www.youtube.com/embed/${id}` : null;
  }
  if (VIMEO_HOSTS.has(host)) {
    const id = [...parts].reverse().find((p) => /^\d+$/.test(p));
    return id && VIMEO_ID.test(id) ? `https://player.vimeo.com/video/${id}` : null;
  }
  return null;
}

const httpUrl = z
  .string()
  .trim()
  .max(1000, 'Đường dẫn quá dài')
  .refine((v) => parseHttpUrl(v) !== null, 'Đường dẫn phải bắt đầu bằng http:// hoặc https://');

const videoUrl = z
  .string()
  .trim()
  .max(500, 'Đường dẫn quá dài')
  .refine((v) => toEmbedUrl(v) !== null, 'Chỉ chấp nhận link video YouTube hoặc Vimeo hợp lệ');

const level = z.number().int('Cấp độ phải là số nguyên').min(1, 'Cấp độ từ 1 đến 9').max(9, 'Cấp độ từ 1 đến 9');

const title = z.string().trim().min(1, 'Vui lòng nhập tiêu đề').max(200, 'Tiêu đề tối đa 200 ký tự');

const attachment = z.object({
  name: z.string().trim().min(1, 'Tên tệp không được trống').max(200),
  url: httpUrl,
  size: z.number().int().min(0).max(5_000_000_000).optional(),
});

const accessMode = z.enum(['all', 'level', 'paid', 'selected']);
const modulePublishStatus = z.enum(['published', 'draft', 'archived']);
const priceCents = z
  .number()
  .int('Giá phải là số nguyên (cent)')
  .min(1, 'Giá phải lớn hơn 0')
  .max(100000 * 100, 'Giá tối đa 100.000');

export const createModuleSchema = z.object({
  /** Chỉ route cũ (/courses/:id/modules) dùng: khóa học đích; bỏ trống = khóa mặc định. Route mới lấy :courseId từ URL. */
  learningCourseId: z.string().min(1).max(100).optional(),
  title,
  description: z.string().trim().max(1000, 'Mô tả tối đa 1000 ký tự'),
  thumbnail: httpUrl.optional(),
  requiredLevel: level.optional(),
  accessMode: accessMode.optional(),
  priceCents: priceCents.optional(),
  sequential: z.boolean().optional(),
  publishStatus: modulePublishStatus.optional(),
});

export const updateModuleSchema = z
  .object({
    title: title.optional(),
    description: z.string().trim().max(1000).optional(),
    thumbnail: httpUrl.nullable().optional(),
    requiredLevel: level.nullable().optional(),
    accessMode: accessMode.optional(),
    priceCents: priceCents.nullable().optional(),
    sequential: z.boolean().optional(),
    publishStatus: modulePublishStatus.optional(),
    /** Cờ một lần, chỉ có tác dụng khi PATCH này chuyển draft → published; không được lưu. */
    notifyMembers: z.boolean().optional(),
    announce: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Không có trường nào để cập nhật');

const lessonFields = {
  title,
  type: z.enum(['video', 'text', 'file']),
  durationMin: z.number().int('Thời lượng phải là số nguyên').min(0).max(1000),
  body: z.string().max(50_000, 'Nội dung tối đa 50.000 ký tự'),
  videoUrl,
  attachments: z.array(attachment).max(20, 'Tối đa 20 tệp đính kèm'),
  isPreview: z.boolean(),
};

export const createLessonSchema = z.object({
  ...lessonFields,
  videoUrl: lessonFields.videoUrl.optional(),
  attachments: lessonFields.attachments.optional(),
  isPreview: lessonFields.isPreview.optional(),
});

export const updateLessonSchema = z
  .object({
    title: lessonFields.title.optional(),
    type: lessonFields.type.optional(),
    durationMin: lessonFields.durationMin.optional(),
    body: lessonFields.body.optional(),
    videoUrl: lessonFields.videoUrl.nullable().optional(),
    attachments: lessonFields.attachments.optional(),
    isPreview: lessonFields.isPreview.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Không có trường nào để cập nhật');

export const moduleAccessSchema = z.object({
  userIds: z.array(z.string().min(1).max(100)).max(500, 'Tối đa 500 thành viên'),
});

export const reorderSchema = z.object({
  ids: z.array(z.string().min(1)).max(500),
});

export const classroomSettingsSchema = z.object({
  certificatesEnabled: z.boolean(),
});

const courseTitle = z.string().trim().min(1, 'Vui lòng nhập tên khóa học').max(200, 'Tên khóa học tối đa 200 ký tự');

export const createCourseSchema = z.object({
  title: courseTitle,
  description: z.string().trim().max(1000, 'Mô tả tối đa 1000 ký tự').default(''),
  thumbnailUrl: httpUrl.optional(),
  publishStatus: z.enum(['published', 'draft']).optional(),
});

export const updateCourseSchema = z
  .object({
    title: courseTitle.optional(),
    description: z.string().trim().max(1000).optional(),
    thumbnailUrl: httpUrl.nullable().optional(),
    publishStatus: z.enum(['published', 'draft', 'archived']).optional(),
    certificatesEnabled: z.boolean().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Không có trường nào để cập nhật');

export const listCoursesQuery = z.object({
  status: z.string().max(100).optional(),
});

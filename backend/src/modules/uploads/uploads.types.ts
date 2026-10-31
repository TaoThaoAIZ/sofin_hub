import { env } from '../../config/env.js';

export const UPLOAD_PURPOSES = [
  'post_image',
  'post_file',
  'avatar',
  'cover',
  'lesson_attachment',
  'message_attachment',
  'community_media',
  'lesson_video',
  'lesson_slide',
] as const;
export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number];

export interface UploadRecord {
  key: string;
  ownerId: string;
  filename: string;
  contentType: string;
  /** Dung lượng khai báo lúc presign; được thay bằng dung lượng thực sau khi PUT xong. */
  size: number;
  purpose: UploadPurpose;
  communityId?: string;
  /** @deprecated alias của communityId. */
  courseId?: string;
  status: 'pending' | 'uploaded';
  /** true khi Platform Admin đã gỡ file: không còn phục vụ công khai. */
  removed?: boolean;
  /** Bản web của video bài học (MediaConvert); undefined = chưa chuyển mã. */
  webStatus?: 'processing' | 'ready' | 'failed';
  webJobId?: string;
  createdAt: string;
}

const MB = 1024 * 1024;

/** Loại nội dung được phép → đuôi file. SVG/HTML cố tình KHÔNG có (XSS). */
export const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
export const DOC_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/zip': 'zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.openxmlformats-officedocument.presentationml.slideshow': 'ppsx',
  // Office bản cũ (OLE2): .doc / .ppt / .xls
  'application/msword': 'doc',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.ms-excel': 'xls',
  'text/plain': 'txt',
  'text/csv': 'csv',
};
export const VIDEO_TYPES: Record<string, string> = { 'video/mp4': 'mp4' };
/** Video bài học: thêm webm/mov (trình duyệt phát được; mov chỉ khi mã hóa H.264). */
export const LESSON_VIDEO_TYPES: Record<string, string> = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };
export const SLIDE_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.openxmlformats-officedocument.presentationml.slideshow': 'ppsx',
  'application/vnd.ms-powerpoint': 'ppt',
};

/** Đuôi → Content-Type khi phục vụ file (không tin gì từ tên file người dùng). */
/** Loại file bất kỳ (exe, rar, json...): lưu với đuôi 'bin', luôn phục vụ dạng tải về (attachment + nosniff + CSP sandbox), tên gốc nằm ở bản ghi. */
export const GENERIC_TYPE = 'application/octet-stream';
export const GENERIC_EXT = 'bin';

export const EXT_TO_TYPE: Record<string, string> = Object.fromEntries(
  Object.entries({ ...IMAGE_TYPES, ...DOC_TYPES, ...LESSON_VIDEO_TYPES, [GENERIC_TYPE]: GENERIC_EXT }).map(([type, ext]) => [ext, type]),
);

export interface PurposeRule {
  types: Record<string, string>;
  maxBytes: number;
  /** true = nhận mọi loại file; loại không có trong `types` được lưu dạng GENERIC_TYPE. */
  anyType?: boolean;
}

/** Đọc env lúc gọi (không cache) để chỉnh cấu hình được mà không cần khởi động lại khi test. */
export function purposeRule(purpose: UploadPurpose): PurposeRule {
  const file = env.UPLOAD_MAX_FILE_MB * MB;
  switch (purpose) {
    case 'post_image':
      return { types: IMAGE_TYPES, maxBytes: env.UPLOAD_MAX_IMAGE_MB * MB };
    case 'avatar':
      return { types: IMAGE_TYPES, maxBytes: env.UPLOAD_MAX_AVATAR_MB * MB };
    case 'cover':
      return { types: IMAGE_TYPES, maxBytes: env.UPLOAD_MAX_COVER_MB * MB };
    case 'community_media':
      return { types: { ...IMAGE_TYPES, ...VIDEO_TYPES }, maxBytes: file };
    case 'lesson_video':
      return { types: LESSON_VIDEO_TYPES, maxBytes: env.UPLOAD_MAX_VIDEO_MB * MB };
    case 'lesson_slide':
      return { types: SLIDE_TYPES, maxBytes: env.UPLOAD_MAX_SLIDE_MB * MB };
    case 'lesson_attachment':
      return { types: { ...DOC_TYPES, ...VIDEO_TYPES }, maxBytes: env.UPLOAD_MAX_VIDEO_MB * MB };
    case 'post_file':
      return { types: { ...DOC_TYPES, ...IMAGE_TYPES, ...LESSON_VIDEO_TYPES }, maxBytes: file };
    case 'message_attachment':
      return { types: { ...IMAGE_TYPES, ...DOC_TYPES, ...LESSON_VIDEO_TYPES }, maxBytes: file, anyType: true };
  }
}

/** Mục đích upload dạng STREAM (không nạp cả file vào RAM): video dài, slide lớn. Bắt buộc có Content-Length. */
export const STREAMED_PURPOSES: readonly UploadPurpose[] = ['lesson_video', 'lesson_slide', 'lesson_attachment', 'post_file', 'community_media', 'message_attachment'];
export const isStreamedPurpose = (p: UploadPurpose) => STREAMED_PURPOSES.includes(p);
/** Mục đích gắn với một cộng đồng (mod+ mới được upload; thành viên cộng đồng mới được xem). */
export const COMMUNITY_PURPOSES: readonly UploadPurpose[] = ['lesson_attachment', 'lesson_video', 'lesson_slide'];
export const isCommunityPurpose = (p: UploadPurpose) => COMMUNITY_PURPOSES.includes(p);

export const KEY_PATTERN = /^[a-f0-9]{32}\.[a-z0-9]{2,5}$/;
export const FILE_URL_PREFIX = '/api/files/';

/** Ảnh công khai (avatar/bìa/ảnh bài viết): ai có URL cũng xem được, cache dài. Mục đích khác là RIÊNG TƯ (cần đăng nhập + quyền). */
export const PUBLIC_PURPOSES: readonly UploadPurpose[] = ['avatar', 'cover', 'post_image', 'community_media'];
export const isPublicPurpose = (p: UploadPurpose) => PUBLIC_PURPOSES.includes(p);

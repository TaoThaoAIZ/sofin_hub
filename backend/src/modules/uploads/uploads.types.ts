import { env } from '../../config/env.js';

export const UPLOAD_PURPOSES = [
  'post_image',
  'post_file',
  'avatar',
  'cover',
  'lesson_attachment',
  'message_attachment',
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
  courseId?: string;
  status: 'pending' | 'uploaded';
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
  'text/plain': 'txt',
};
export const VIDEO_TYPES: Record<string, string> = { 'video/mp4': 'mp4' };

/** Đuôi → Content-Type khi phục vụ file (không tin gì từ tên file người dùng). */
export const EXT_TO_TYPE: Record<string, string> = Object.fromEntries(
  Object.entries({ ...IMAGE_TYPES, ...DOC_TYPES, ...VIDEO_TYPES }).map(([type, ext]) => [ext, type]),
);

export interface PurposeRule {
  types: Record<string, string>;
  maxBytes: number;
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
    case 'post_file':
    case 'lesson_attachment':
      return { types: { ...DOC_TYPES, ...VIDEO_TYPES }, maxBytes: file };
    case 'message_attachment':
      return { types: { ...IMAGE_TYPES, ...DOC_TYPES }, maxBytes: file };
  }
}

export const KEY_PATTERN = /^[a-f0-9]{32}\.[a-z0-9]{2,5}$/;
export const FILE_URL_PREFIX = '/api/files/';

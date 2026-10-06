import { useCallback, useState } from 'react';
import i18n from '../../i18n';
import { ApiError, apiPost, resolveApiPath } from '../../lib/api';

export type UploadPurpose = 'post_image' | 'post_file' | 'avatar' | 'cover' | 'lesson_attachment' | 'message_attachment';

export interface UploadedFile {
  /** Đường dẫn file do BE trả (vd. "/api/files/<key>") — lưu nguyên giá trị này vào bài viết/tin nhắn/avatar. */
  url: string;
  key: string;
  name: string;
  contentType: string;
  size: number;
}

const MB = 1024 * 1024;
const IMAGES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const DOCS = [
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
];

// Khớp bảng whitelist ở backend/docs/api/uploads.md (chỉ để báo lỗi sớm — BE vẫn kiểm tra lại).
const RULES: Record<UploadPurpose, { types: string[]; maxMb: number; label: 'images' | 'files' | 'message' }> = {
  post_image: { types: IMAGES, maxMb: 5, label: 'images' },
  avatar: { types: IMAGES, maxMb: 3, label: 'images' },
  cover: { types: IMAGES, maxMb: 8, label: 'images' },
  post_file: { types: [...DOCS, 'video/mp4'], maxMb: 25, label: 'files' },
  lesson_attachment: { types: [...DOCS, 'video/mp4'], maxMb: 25, label: 'files' },
  message_attachment: { types: [...IMAGES, ...DOCS], maxMb: 25, label: 'message' },
};

/** Kiểm tra sớm ở FE; trả về thông báo lỗi tiếng Việt hoặc null nếu hợp lệ. */
export function validateUpload(file: File, purpose: UploadPurpose): string | null {
  const rule = RULES[purpose];
  if (file.size === 0) return i18n.t('upload.empty', { ns: 'misc' });
  if (file.size > rule.maxMb * MB) return i18n.t('upload.tooLarge', { ns: 'misc', max: rule.maxMb });
  if (!rule.types.includes(file.type)) return i18n.t('upload.unsupported', { ns: 'misc', types: i18n.t(`upload.labels.${rule.label}`, { ns: 'misc' }) });
  return null;
}

interface PresignResponse {
  data: { uploadUrl: string; method: 'PUT'; headers: Record<string, string>; fileUrl: string; key: string; expiresAt: string };
}

/**
 * Upload file qua luồng presign: POST /uploads/presign -> PUT tới uploadUrl -> trả về fileUrl.
 * `upload()` ném Error (message tiếng Việt) khi thất bại và đồng thời đặt `error`.
 */
export function useUpload() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    async (file: File, opts: { purpose: UploadPurpose; courseId?: string }): Promise<UploadedFile> => {
      setError(null);
      const early = validateUpload(file, opts.purpose);
      if (early) {
        setError(early);
        throw new Error(early);
      }
      setUploading(true);
      try {
        const presign = await apiPost<PresignResponse>('/uploads/presign', {
          filename: file.name,
          contentType: file.type,
          size: file.size,
          purpose: opts.purpose,
          ...(opts.courseId ? { courseId: opts.courseId } : {}),
        }).then((r) => r.data);

        const res = await fetch(resolveApiPath(presign.uploadUrl), {
          method: presign.method || 'PUT',
          headers: presign.headers,
          body: file,
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: { message?: string; code?: string } } | null;
          throw new ApiError(res.status, body?.error?.message ?? i18n.t('upload.failedStatus', { ns: 'misc', status: res.status }), body?.error?.code);
        }
        return { url: presign.fileUrl, key: presign.key, name: file.name, contentType: file.type, size: file.size };
      } catch (err) {
        let msg = i18n.t('upload.failed', { ns: 'misc' });
        if (err instanceof ApiError) {
          if (err.status === 413) {
            msg = err.code === 'QUOTA_EXCEEDED' ? i18n.t('upload.quota', { ns: 'misc' }) : i18n.t('upload.tooLargeLimit', { ns: 'misc' });
          } else if (err.status === 403) {
            msg = err.message || i18n.t('upload.forbidden', { ns: 'misc' });
          } else {
            msg = err.message;
          }
        }
        setError(msg);
        throw new Error(msg);
      } finally {
        setUploading(false);
      }
    },
    [],
  );

  return { upload, uploading, error };
}

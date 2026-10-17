import { useCallback, useState } from 'react';
import i18n from '../../i18n';
import { ApiError, apiPost, resolveApiPath } from '../../lib/api';

export type UploadPurpose =
  | 'post_image'
  | 'post_file'
  | 'avatar'
  | 'cover'
  | 'lesson_attachment'
  | 'message_attachment'
  | 'community_media'
  | 'lesson_video'
  | 'lesson_slide';

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
  'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
  'application/msword',
  'application/vnd.ms-powerpoint',
  'application/vnd.ms-excel',
  'text/plain',
  'text/csv',
];
const LESSON_VIDEOS = ['video/mp4', 'video/webm', 'video/quicktime'];
const SLIDES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
  'application/vnd.ms-powerpoint',
];

type Label = 'images' | 'files' | 'message' | 'media' | 'video' | 'slides';

// Khớp bảng whitelist ở backend (uploads.types.ts) — chỉ để báo lỗi sớm; BE vẫn kiểm tra lại. Giới hạn video/slide khớp UPLOAD_MAX_VIDEO_MB / UPLOAD_MAX_SLIDE_MB.
const RULES: Record<UploadPurpose, { types: string[]; maxMb: number; label: Label }> = {
  post_image: { types: IMAGES, maxMb: 5, label: 'images' },
  avatar: { types: IMAGES, maxMb: 3, label: 'images' },
  cover: { types: IMAGES, maxMb: 8, label: 'images' },
  post_file: { types: [...DOCS, 'video/mp4'], maxMb: 25, label: 'files' },
  lesson_attachment: { types: [...DOCS, 'video/mp4'], maxMb: 25, label: 'files' },
  message_attachment: { types: [...IMAGES, ...DOCS], maxMb: 25, label: 'message' },
  community_media: { types: [...IMAGES, 'video/mp4'], maxMb: 25, label: 'media' },
  lesson_video: { types: LESSON_VIDEOS, maxMb: 2048, label: 'video' },
  lesson_slide: { types: SLIDES, maxMb: 200, label: 'slides' },
};

/** Trình duyệt hay trả type rỗng/octet-stream cho Office cũ, ppsx, csv, mov...: suy từ đuôi tệp. */
const EXT_TYPE: Record<string, string> = {
  pdf: 'application/pdf',
  zip: 'application/zip',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ppsx: 'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
  doc: 'application/msword',
  ppt: 'application/vnd.ms-powerpoint',
  xls: 'application/vnd.ms-excel',
  txt: 'text/plain',
  csv: 'text/csv',
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

/** Loại nội dung dùng để upload: ưu tiên type của trình duyệt khi hợp lệ, không thì suy từ đuôi tệp. */
export function resolveContentType(file: File): string {
  const known = file.type && file.type !== 'application/octet-stream' ? file.type : '';
  if (known === 'application/x-zip-compressed') return 'application/zip';
  if (known) return known;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return EXT_TYPE[ext] ?? '';
}

/** Giá trị cho thuộc tính `accept` của <input type="file"> theo mục đích. */
export const acceptFor = (purpose: UploadPurpose) => {
  const exts = Object.entries(EXT_TYPE)
    .filter(([, t]) => RULES[purpose].types.includes(t))
    .map(([e]) => `.${e}`);
  return exts.join(',');
};

/** Kiểm tra sớm ở FE; trả về thông báo lỗi tiếng Việt hoặc null nếu hợp lệ. */
export function validateUpload(file: File, purpose: UploadPurpose): string | null {
  const rule = RULES[purpose];
  if (file.size === 0) return i18n.t('upload.empty', { ns: 'misc' });
  if (file.size > rule.maxMb * MB) return i18n.t('upload.tooLarge', { ns: 'misc', max: rule.maxMb });
  if (!rule.types.includes(resolveContentType(file))) return i18n.t('upload.unsupported', { ns: 'misc', types: i18n.t(`upload.labels.${rule.label}`, { ns: 'misc' }) });
  return null;
}

interface PresignResponse {
  data: {
    /** `direct` = PUT thẳng lên S3 (presigned); `proxy` (hoặc thiếu) = PUT qua backend bằng vé HMAC. */
    mode?: 'direct' | 'proxy';
    uploadUrl: string;
    method: 'PUT';
    headers: Record<string, string>;
    fileUrl: string;
    key: string;
    expiresAt: string;
    multipart?: { uploadId: string; partSize: number; partUrls: string[] };
  };
}

/** PUT file bằng XMLHttpRequest để có tiến độ (fetch không báo tiến độ upload) và hủy được. Trả về `{status, body, etag}`. */
function putWithProgress(url: string, headers: Record<string, string>, body: Blob, onProgress: (loaded: number, total: number) => void, signal?: AbortSignal) {
  return new Promise<{ status: number; body: string; etag: string | null }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded, e.total);
    };
    xhr.onload = () => {
      onProgress(body.size, body.size);
      resolve({ status: xhr.status, body: xhr.responseText, etag: xhr.getResponseHeader('ETag') });
    };
    xhr.onerror = () => reject(new Error('network'));
    xhr.onabort = () => reject(new DOMException('Aborted', 'AbortError'));
    xhr.ontimeout = () => reject(new Error('timeout'));
    signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(body);
  });
}

const PART_CONCURRENCY = 4;
const PART_RETRIES = 3;

/** Upload multipart: chia file thành phần, PUT song song (PART_CONCURRENCY), mỗi phần thử lại tối đa PART_RETRIES lần. Trả ETag từng phần. */
async function uploadParts(file: File, mp: { partSize: number; partUrls: string[] }, onProgress: (pct: number) => void, signal?: AbortSignal) {
  const loaded = new Array<number>(mp.partUrls.length).fill(0);
  const etags = new Array<string>(mp.partUrls.length);
  const report = () => onProgress(Math.min(99, Math.floor((loaded.reduce((a, b) => a + b, 0) / file.size) * 100)));
  let next = 0;
  const worker = async () => {
    while (next < mp.partUrls.length) {
      const i = next++;
      const blob = file.slice(i * mp.partSize, Math.min(file.size, (i + 1) * mp.partSize));
      for (let attempt = 1; ; attempt++) {
        try {
          const res = await putWithProgress(mp.partUrls[i]!, {}, blob, (l) => {
            loaded[i] = l;
            report();
          }, signal);
          if (res.status < 200 || res.status >= 300) throw new ApiError(res.status, i18n.t('upload.failedStatus', { ns: 'misc', status: res.status }));
          if (!res.etag) throw new Error('missing-etag'); // bucket thiếu CORS ExposeHeaders: ETag
          etags[i] = res.etag;
          loaded[i] = blob.size;
          report();
          break;
        } catch (err) {
          if ((err instanceof DOMException && err.name === 'AbortError') || attempt >= PART_RETRIES) throw err;
          loaded[i] = 0;
          await new Promise((r) => setTimeout(r, 500 * attempt));
        }
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(PART_CONCURRENCY, mp.partUrls.length) }, worker));
  return etags.map((etag, i) => ({ partNumber: i + 1, etag }));
}

/**
 * Upload file qua luồng presign: POST /uploads/presign -> PUT tới uploadUrl (có tiến độ 0-100) -> trả về fileUrl.
 * `upload()` ném Error (message tiếng Việt) khi thất bại và đồng thời đặt `error`.
 */
export function useUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    async (file: File, opts: { purpose: UploadPurpose; courseId?: string; signal?: AbortSignal }): Promise<UploadedFile> => {
      setError(null);
      setProgress(0);
      const early = validateUpload(file, opts.purpose);
      if (early) {
        setError(early);
        throw new Error(early);
      }
      const contentType = resolveContentType(file);
      setUploading(true);
      try {
        const presign = await apiPost<PresignResponse>('/uploads/presign', {
          filename: file.name,
          contentType,
          size: file.size,
          purpose: opts.purpose,
          ...(opts.courseId ? { courseId: opts.courseId } : {}),
        }).then((r) => r.data);

        const pct = (p: number) => setProgress(Math.min(99, p));
        if (presign.mode === 'direct') {
          // Upload thẳng lên S3 rồi báo backend xác nhận (ghép phần, kiểm dung lượng + magic bytes).
          const uploadId = presign.multipart?.uploadId;
          try {
            let parts: { partNumber: number; etag: string }[] | undefined;
            if (presign.multipart) {
              parts = await uploadParts(file, presign.multipart, pct, opts.signal);
            } else {
              const res = await putWithProgress(presign.uploadUrl, { ...presign.headers, 'Content-Type': contentType }, file, (l, t) => pct(Math.floor((l / t) * 100)), opts.signal);
              if (res.status < 200 || res.status >= 300) throw new ApiError(res.status, i18n.t('upload.failedStatus', { ns: 'misc', status: res.status }));
            }
            // Backend ghép phần + kiểm file có thể mất vài phút với video lớn; quá 10 phút coi là treo để người dùng thấy lỗi thay vì đứng mãi.
            await apiPost(`/uploads/${presign.key}/complete`, { ...(uploadId ? { uploadId, parts } : {}) }, { signal: AbortSignal.timeout(10 * 60_000) });
          } catch (err) {
            void apiPost(`/uploads/${presign.key}/abort`, { ...(uploadId ? { uploadId } : {}) }).catch(() => undefined);
            throw err;
          }
          setProgress(100);
          return { url: presign.fileUrl, key: presign.key, name: file.name, contentType, size: file.size };
        }

        const res = await putWithProgress(resolveApiPath(presign.uploadUrl), { ...presign.headers, 'Content-Type': contentType }, file, (l, t) => pct(Math.floor((l / t) * 100)), opts.signal);
        setProgress(100);
        if (res.status < 200 || res.status >= 300) {
          const body = (() => {
            try {
              return JSON.parse(res.body) as { error?: { message?: string; code?: string } };
            } catch {
              return null;
            }
          })();
          throw new ApiError(res.status, body?.error?.message ?? i18n.t('upload.failedStatus', { ns: 'misc', status: res.status }), body?.error?.code);
        }
        return { url: presign.fileUrl, key: presign.key, name: file.name, contentType, size: file.size };
      } catch (err) {
        let msg = i18n.t('upload.failed', { ns: 'misc' });
        if (err instanceof DOMException && err.name === 'AbortError') {
          msg = i18n.t('upload.cancelled', { ns: 'misc' });
        } else if (err instanceof ApiError) {
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

  return { upload, uploading, progress, error };
}

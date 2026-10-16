import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../../../../components/ui/MaterialIcon';
import { resolveApiPath } from '../../../../lib/api';
import type { CommunityMediaItem } from '../../../courses/types';
import { useUpload } from '../../../uploads/useUpload';

export const MAX_MEDIA = 12;

/** Quản lý thư viện ảnh/video giới thiệu: chọn nhiều tệp một lần, xóa, đưa lên trước (mục đầu là mục hiển thị chính). */
export function MediaField({ value, onChange }: { value: CommunityMediaItem[]; onChange: (v: CommunityMediaItem[]) => void }) {
  const { t } = useTranslation('communities');
  const inputRef = useRef<HTMLInputElement>(null);
  const { upload, uploading, error } = useUpload();

  const pick = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    let next = [...value];
    for (const file of Array.from(files)) {
      if (next.length >= MAX_MEDIA) break;
      try {
        const res = await upload(file, { purpose: 'community_media' });
        next = [...next, { type: file.type.startsWith('video/') ? 'video' : 'image', url: res.url }];
        onChange(next);
      } catch {
        /* lỗi đã nằm trong `error`; các tệp đã tải xong vẫn được giữ */
      }
    }
  };

  const move = (idx: number, to: number) => {
    const next = [...value];
    const [m] = next.splice(idx, 1);
    next.splice(to, 0, m!);
    onChange(next);
  };

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[13.5px] font-semibold text-stone-800">{t('general.media')}</span>
        <span className="text-xs text-stone-500">
          {value.length}/{MAX_MEDIA}
        </span>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3">
        {value.map((m, idx) => (
          <div key={m.url} className="relative aspect-[4/3] overflow-hidden rounded-xl border border-[rgba(120,60,20,.12)] bg-[#1c130e]">
            {m.type === 'video' ? (
              <>
                <video src={`${resolveApiPath(m.url)}#t=0.1`} preload="metadata" muted playsInline className="size-full object-cover" />
                <span className="absolute inset-0 grid place-items-center bg-black/30">
                  <MaterialIcon name="play_circle" size={30} filled color="#fff" />
                </span>
              </>
            ) : (
              <img src={resolveApiPath(m.url)} alt="" className="size-full object-cover" />
            )}
            {idx === 0 && <span className="absolute top-1.5 left-1.5 rounded-md bg-brand px-1.5 py-0.5 text-[10.5px] font-bold text-white">{t('general.mediaMain')}</span>}
            <div className="absolute right-1.5 bottom-1.5 flex gap-1">
              {idx > 0 && (
                <button type="button" aria-label={t('general.mediaMoveFirst')} title={t('general.mediaMoveFirst')} onClick={() => move(idx, 0)} className="grid size-7 place-items-center rounded-full border-0 bg-black/60 text-white">
                  <MaterialIcon name="keyboard_double_arrow_left" size={16} color="#fff" />
                </button>
              )}
              <button type="button" aria-label={t('general.mediaRemove')} title={t('general.mediaRemove')} onClick={() => onChange(value.filter((_, j) => j !== idx))} className="grid size-7 place-items-center rounded-full border-0 bg-black/60 text-white">
                <MaterialIcon name="close" size={16} color="#fff" />
              </button>
            </div>
          </div>
        ))}
        {value.length < MAX_MEDIA && (
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="grid aspect-[4/3] cursor-pointer place-items-center rounded-xl border-[1.5px] border-dashed border-[#e7c9b2] bg-[#fffaf6] p-2 text-center text-[12.5px] text-stone-500 hover:bg-brand-soft disabled:opacity-60"
          >
            <span className="flex flex-col items-center gap-1">
              <MaterialIcon name="add_photo_alternate" size={24} color="#ff570a" />
              {uploading ? t('general.mediaUploading') : t('general.mediaAdd')}
            </span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/gif,video/mp4"
        className="hidden"
        onChange={(e) => {
          void pick(e.target.files);
          e.target.value = '';
        }}
      />
      <span className="mt-1 block text-xs text-stone-500">{t('general.mediaHint')}</span>
      {error && (
        <p role="alert" className="mt-1.5 text-[13px] font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

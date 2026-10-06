import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../../components/ui/MaterialIcon';
import { resolveApiPath } from '../../lib/api';
import { useUpload, type UploadPurpose } from '../uploads/useUpload';

/** Ô tải ảnh (logo/ảnh bìa) qua luồng presign có sẵn: chọn tệp → /uploads/presign → PUT → lưu fileUrl. */
export function ImageSlot({
  value,
  onChange,
  purpose,
  placeholder,
  ariaLabel,
  className = '',
}: {
  value: string;
  onChange: (url: string) => void;
  purpose: Extract<UploadPurpose, 'avatar' | 'cover'>;
  placeholder: string;
  ariaLabel: string;
  className?: string;
}) {
  const { t } = useTranslation('wizard');
  const inputRef = useRef<HTMLInputElement>(null);
  const { upload, uploading, error } = useUpload();
  const [drag, setDrag] = useState(false);

  const pick = async (file?: File | null) => {
    if (!file) return;
    try {
      const res = await upload(file, { purpose });
      onChange(res.url);
    } catch {
      /* lỗi đã nằm trong `error` */
    }
  };

  return (
    <div className={className}>
      <div
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          void pick(e.dataTransfer.files[0]);
        }}
        className={`relative grid h-[104px] cursor-pointer place-items-center overflow-hidden rounded-[14px] border-[1.5px] border-dashed ${drag ? 'border-brand bg-brand-soft' : 'border-[#fdba74] bg-[#fffaf6]'}`}
      >
        {value ? (
          <img src={resolveApiPath(value)} alt="" className="size-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1 px-3 text-center text-[12.5px] text-stone-500">
            <MaterialIcon name="cloud_upload" size={24} color="#f26a1b" />
            {placeholder}
          </span>
        )}
        {uploading && <span className="absolute inset-0 grid place-items-center bg-white/70 text-sm font-semibold text-brand">{t('imageSlot.uploading')}</span>}
        {value && !uploading && (
          <span className="absolute right-1.5 bottom-1.5 flex gap-1">
            <button
              type="button"
              aria-label={t('imageSlot.remove')}
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="grid size-7 place-items-center rounded-full border-0 bg-black/60 text-white"
            >
              <MaterialIcon name="close" size={16} color="#fff" />
            </button>
          </span>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
      {error && <p role="alert" className="mt-1.5 ml-1 text-[13px] font-medium text-red-600">{error}</p>}
    </div>
  );
}

import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { useUpload } from '../../uploads/useUpload';
import { absoluteUrl, FieldLabel, safeUrl } from './contentUi';

/** Ô ảnh bìa vuông trong dialog: bấm để tải ảnh lên, hoặc dán URL phía dưới. */
export function CoverField({
  value,
  onChange,
  onError,
  label,
  ariaLabel,
  height,
}: {
  value: string;
  onChange: (url: string) => void;
  onError?: (message: string | null) => void;
  label?: string;
  ariaLabel: string;
  /** Có thì ô ảnh rộng bằng cột và cao cố định (px); không thì ô vuông 220px. */
  height?: number;
}) {
  const { t } = useTranslation('community');
  const { upload, uploading, error } = useUpload();
  const fileRef = useRef<HTMLInputElement>(null);
  const shown = safeUrl(value || undefined);
  useEffect(() => {
    onError?.(error ?? null);
  }, [error, onError]);
  return (
    <div className={height ? 'w-full min-w-0' : 'w-full sm:w-[220px] sm:flex-none'}>
      <FieldLabel>{label ?? t('dialogForm.cover')}</FieldLabel>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          try {
            const up = await upload(f, { purpose: 'cover' });
            onChange(absoluteUrl(up.url));
          } catch {
            /* lỗi hiển thị qua error */
          }
        }}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        aria-label={ariaLabel}
        style={height ? { height } : undefined}
        className={`relative grid w-full place-items-center overflow-hidden rounded-2xl border-[1.5px] border-dashed border-[rgba(120,60,20,.25)] bg-[#faf7f4] text-[13px] font-medium text-stone-600 hover:border-brand ${height ? '' : 'aspect-[16/10] sm:aspect-square'}`}
      >
        {shown ? (
          <>
            <img src={shown} alt="" className="absolute inset-0 size-full object-cover" />
            <span className="absolute inset-x-0 bottom-0 bg-black/45 py-1.5 text-xs font-semibold text-white">{t('dialogForm.coverChange')}</span>
          </>
        ) : (
          <span className="flex flex-col items-center gap-1.5 px-3 text-center">
            <MaterialIcon name="image" size={30} color="#78716c" />
            {uploading ? t('courseForm.uploading') : t('dialogForm.coverHint')}
          </span>
        )}
      </button>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('dialogForm.coverUrlPh')}
        aria-label={ariaLabel}
        className="mt-2 h-9 w-full rounded-xl border border-[rgba(120,60,20,.12)] bg-white px-3 text-[12.5px] outline-0 focus:border-brand"
      />
    </div>
  );
}

import { useState, type ReactNode } from 'react';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { resolveApiPath } from '../../../lib/api';
import type { CommunityMediaItem } from '../types';

/**
 * Ảnh/video giới thiệu cộng đồng: khung lớn + dải ảnh nhỏ để chọn. Không có `items` thì chỉ hiện `fallback` (ảnh bìa cũ).
 * `overlay` là lớp phủ đặt trên khung lớn (vd. nhãn tag).
 */
export function MediaGallery({
  items,
  fallback,
  alt,
  className = 'aspect-[1135/600]',
  overlay,
}: {
  items: CommunityMediaItem[];
  fallback: string;
  alt: string;
  className?: string;
  overlay?: ReactNode;
}) {
  const list: CommunityMediaItem[] = items.length > 0 ? items : [{ type: 'image', url: fallback }];
  const [i, setI] = useState(0);
  const cur = list[Math.min(i, list.length - 1)]!;

  return (
    <div className="flex flex-col gap-4">
      <div className={`relative overflow-hidden rounded-3xl bg-[#2a1a10] shadow-[1px_6px_30px_2px_rgba(121,81,54,0.1)] dark:shadow-none ${className}`}>
        {cur.type === 'video' ? (
          <video key={cur.url} src={resolveApiPath(cur.url)} controls playsInline preload="metadata" className="size-full bg-black object-contain" />
        ) : (
          <img src={resolveApiPath(cur.url)} alt={alt} className="size-full object-cover" />
        )}
        {overlay}
      </div>
      {list.length > 1 && (
        <div className="no-scrollbar flex gap-4 overflow-x-auto pb-1" role="tablist">
          {list.map((m, idx) => (
            <button
              key={m.url}
              type="button"
              role="tab"
              aria-selected={idx === i}
              aria-label={`${alt} ${idx + 1}`}
              onClick={() => setI(idx)}
              className={`relative aspect-[188/100] w-[clamp(120px,10.4vw,188px)] flex-none overflow-hidden rounded-2xl border bg-[#1c130e] p-0 ${idx === i ? 'border-brand ring-1 ring-brand' : 'border-[#dfdfdf] opacity-90 hover:opacity-100 dark:border-white/10'}`}
            >
              {m.type === 'video' ? (
                <>
                  <video src={`${resolveApiPath(m.url)}#t=0.1`} preload="metadata" muted playsInline className="size-full object-cover" />
                  <span className="absolute inset-0 grid place-items-center bg-black/30">
                    <MaterialIcon name="play_circle" size={26} filled color="#fff" />
                  </span>
                </>
              ) : (
                <img src={resolveApiPath(m.url)} alt="" className="size-full object-cover" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

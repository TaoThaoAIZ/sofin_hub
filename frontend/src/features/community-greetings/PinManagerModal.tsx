import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { MaterialIcon } from '../../components/ui/MaterialIcon';
import { errorText } from '../communities/components/Modal';
import { greetingKeys, pinKeys, togglePostPin, usePins } from './api';

/**
 * Hộp "Quản lý bài ghim" (mod trở lên): danh sách bài đang ghim (tối đa 5 / cộng đồng), bỏ ghim từng bài.
 * Mở khi ghim / đăng thông báo bị 409 PIN_LIMIT (`onRetry` = thao tác vừa bị chặn, bấm sau khi đã bỏ ghim bớt) hoặc từ nút "Quản lý ghim".
 */
export function PinManagerModal({ communityId, onClose, onRetry, retryLabel }: { communityId: string; onClose: () => void; onRetry?: () => Promise<unknown>; retryLabel?: string }) {
  const { t, i18n } = useTranslation('community-greetings');
  const qc = useQueryClient();
  const q = usePins(communityId);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  /** Ghim đổi => bảng tin, danh sách ghim, cài đặt thông báo, popup đều cập nhật. */
  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: pinKeys.list(communityId) }),
      qc.invalidateQueries({ queryKey: ['community', communityId, 'posts'] }),
      qc.invalidateQueries({ queryKey: greetingKeys.settings(communityId) }),
    ]);

  async function act(key: string, fn: () => Promise<unknown>, closeAfter = false) {
    setBusy(key);
    setErr(null);
    try {
      await fn();
      await refresh();
      if (closeAfter) onClose();
    } catch (e) {
      setErr(errorText(e));
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  const pins = q.data?.pins ?? [];
  const limit = q.data?.limit ?? 5;
  const full = pins.length >= limit;
  const fmt = (iso: string) => new Date(iso).toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'vi-VN', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div role="dialog" aria-modal="true" aria-label={t('pins.title')} className="flex max-h-[85vh] w-full max-w-[520px] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center gap-3 border-b border-stone-100 px-5 py-4">
          <div className="grid size-10 place-items-center rounded-xl bg-brand/10">
            <MaterialIcon name="push_pin" size={20} color="#ff570a" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="m-0 text-[17px] font-extrabold">{t('pins.title')}</h2>
            <p className={`m-0 text-xs font-semibold ${full ? 'text-amber-700' : 'text-stone-500'}`}>{t('pins.count', { n: pins.length, limit })}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t('close')} className="grid size-9 place-items-center rounded-xl text-stone-500 hover:bg-stone-100">
            <MaterialIcon name="close" size={20} />
          </button>
        </header>

        <div className="flex flex-col gap-2 overflow-y-auto px-5 py-4">
          {onRetry && full && <p className="m-0 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{t('pins.limitHint', { limit })}</p>}
          {q.isPending && <p className="py-6 text-center text-sm text-stone-500">{t('loading')}</p>}
          {q.error && <p className="m-0 text-sm text-red-600">{errorText(q.error)}</p>}
          {q.data && pins.length === 0 && <p className="py-6 text-center text-sm text-stone-500">{t('pins.empty')}</p>}
          {pins.map((p) => (
            <div key={p.id} className="flex items-start gap-3 rounded-2xl border border-[rgba(120,60,20,.1)] px-4 py-3">
              <div className="min-w-0 flex-1">
                <Link to={p.link} onClick={onClose} className="line-clamp-2 text-sm font-bold text-stone-900 hover:text-brand">
                  {p.title}
                </Link>
                <p className="m-0 mt-1 flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
                  <span className="rounded-md bg-stone-100 px-1.5 py-0.5 font-semibold text-stone-600">{p.category}</span>
                  {p.popup && (
                    <span className="flex items-center gap-0.5 rounded-md bg-brand/10 px-1.5 py-0.5 font-semibold text-brand">
                      <MaterialIcon name="campaign" size={13} />
                      {t('pins.popup', { seen: p.seenCount ?? 0 })}
                    </span>
                  )}
                  <span>
                    {p.author} · {fmt(p.createdAt)}
                  </span>
                </p>
              </div>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void act(p.id, () => togglePostPin(p.id))}
                className="h-8 flex-none rounded-lg border border-[rgba(120,60,20,.15)] px-3 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-60"
              >
                {busy === p.id ? '…' : t('pins.unpin')}
              </button>
            </div>
          ))}
          {err && <p className="m-0 text-sm text-red-600">{err}</p>}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-stone-100 px-5 py-3">
          <button type="button" onClick={onClose} className="h-10 rounded-xl border border-[rgba(120,60,20,.15)] px-4 text-sm font-semibold text-stone-700 hover:bg-stone-50">
            {onRetry ? t('pins.cancel') : t('pins.done')}
          </button>
          {onRetry && (
            <Button disabled={full || busy !== null || q.isPending} onClick={() => void act('retry', onRetry, true)} className="h-10 rounded-xl px-5 text-sm font-bold">
              {busy === 'retry' ? '…' : (retryLabel ?? t('pins.retry'))}
            </Button>
          )}
        </footer>
      </div>
    </div>
  );
}

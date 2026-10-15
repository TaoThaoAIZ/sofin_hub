import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { MaterialIcon } from '../../components/ui/MaterialIcon';
import { useAuth } from '../auth/AuthContext';
import { Avatar } from '../account/components/Avatar';
import { RichText } from '../chatbot/ChatWidget';
import { useStartConversation } from '../messages/useStartConversation';
import { greetingKeys, markAnnouncementSeen, markWelcomeSeen, usePendingGreetings, type GreetingSender, type PendingGreetings } from './api';

/**
 * Popup ở trang cộng đồng: lời chào thành viên mới (1 lần duy nhất / người / cộng đồng), đóng xong tới các thông báo chưa xem dạng slide
 * (cũ -> mới). Slide nào HIỆN là đánh dấu đã xem ngay + xóa khỏi cache => ra trang khác rồi quay lại không hiện lại; slide chưa lật tới
 * (bấm X giữa chừng) vẫn còn cho lần sau.
 */
export function GreetingPopup({ communityId }: { communityId: string }) {
  const { t, i18n } = useTranslation('community-greetings');
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data } = usePendingGreetings(communityId);
  // Bản chụp lúc mở: cache bị xóa dần khi đánh dấu đã xem nhưng popup đang hiện vẫn giữ đủ slide.
  const [snap, setSnap] = useState<PendingGreetings | null>(null);
  const [step, setStep] = useState(0); // 0 = lời chào (nếu có), sau đó lần lượt các thông báo
  const [open, setOpen] = useState(true);
  const marked = useRef(new Set<string>());
  const { startConversation, pendingUserId, error } = useStartConversation();

  useEffect(() => {
    if (data && !snap && (data.welcome || data.announcements.length)) setSnap(data);
  }, [data, snap]);

  const slides = snap ? [...(snap.welcome ? [{ kind: 'welcome' as const, ...snap.welcome }] : []), ...snap.announcements.map((a) => ({ kind: 'announcement' as const, ...a }))] : [];
  const current = open ? slides[step] : undefined;
  const key = current ? (current.kind === 'welcome' ? 'welcome' : current.id) : null;
  const announcements = slides.filter((s) => s.kind === 'announcement');

  useEffect(() => {
    if (!key || marked.current.has(key)) return;
    marked.current.add(key);
    void (key === 'welcome' ? markWelcomeSeen(communityId) : markAnnouncementSeen(communityId, key)).catch(() => undefined);
    qc.setQueryData<PendingGreetings>(greetingKeys.pending(communityId), (old) =>
      old && { welcome: key === 'welcome' ? null : old.welcome, announcements: old.announcements.filter((a) => a.id !== key) },
    );
  }, [key, communityId, qc]);

  useEffect(() => {
    if (!key) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [key]);

  if (!current) return null;
  const close = () => setOpen(false);
  const isLast = step === slides.length - 1;
  const next = () => (isLast ? close() : setStep((s) => s + 1));
  const sender = current.sender;
  const annIndex = current.kind === 'announcement' ? announcements.findIndex((a) => a.id === current.id) : -1;
  const date =
    current.kind === 'announcement' ? new Date(current.createdAt).toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'vi-VN', { day: 'numeric', month: 'long' }) : null;
  const link = current.kind === 'announcement' ? current.link : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-[2px]" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={current.kind === 'welcome' ? t('welcomeLabel') : current.title}
        className="flex max-h-[85vh] w-full max-w-[480px] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-3 border-b border-stone-100 px-5 py-3.5">
          <Avatar url={sender.avatarUrl} name={sender.name} size={44} />
          <div className="min-w-0 flex-1">
            <p className="m-0 flex items-center gap-1.5 truncate text-[15px] font-bold text-stone-900">
              {sender.name}
              {sender.role && sender.role !== 'member' && <RoleBadge role={sender.role} />}
            </p>
            <p className="m-0 flex items-center gap-1 text-xs text-stone-500">
              <MaterialIcon name={current.kind === 'welcome' ? 'waving_hand' : 'campaign'} size={14} />
              {current.kind === 'welcome' ? t('welcomeLabel') : t('announcementLabel', { date })}
              {annIndex >= 0 && announcements.length > 1 && <span className="ml-1 font-semibold text-brand">{t('counter', { n: annIndex + 1, total: announcements.length })}</span>}
            </p>
          </div>
          <button type="button" onClick={close} aria-label={t('close')} className="grid size-9 place-items-center rounded-xl text-stone-500 hover:bg-stone-100">
            <MaterialIcon name="close" size={20} />
          </button>
        </header>

        <div key={key} className="overflow-y-auto px-5 py-4 text-[14.5px] leading-relaxed text-stone-800">
          {current.kind === 'announcement' && <h2 className="mt-0 mb-2 text-lg font-extrabold text-stone-900">{current.title}</h2>}
          <RichText text={current.kind === 'welcome' ? current.message : current.body} />
        </div>

        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-stone-100 px-5 py-3">
          {error && <p className="m-0 mr-auto text-xs text-red-600">{error}</p>}
          {slides.length > 1 && (
            <div className="mr-auto flex items-center gap-1.5" aria-label={t('slides')}>
              <button type="button" onClick={() => setStep((s) => s - 1)} disabled={step === 0} aria-label={t('prev')} className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 disabled:opacity-30">
                <MaterialIcon name="chevron_left" size={20} />
              </button>
              {slides.map((s, i) => (
                <span key={s.kind === 'welcome' ? 'welcome' : s.id} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-4 bg-brand' : 'w-1.5 bg-stone-300'}`} />
              ))}
              <button type="button" onClick={next} disabled={isLast} aria-label={t('next')} className="grid size-8 place-items-center rounded-lg text-stone-500 hover:bg-stone-100 disabled:opacity-30">
                <MaterialIcon name="chevron_right" size={20} />
              </button>
            </div>
          )}
          {current.kind === 'welcome' && sender.id && sender.id !== user?.id && (
            <MessageButton sender={sender} busy={pendingUserId === sender.id} onClick={() => void startConversation(sender.id!)} label={t('reply', { name: sender.name })} />
          )}
          {link &&
            (link.startsWith('https://') ? (
              <a href={link} target="_blank" rel="noopener noreferrer" onClick={close} className={SECONDARY}>
                {t('view')}
              </a>
            ) : (
              <Link to={link} onClick={close} className={SECONDARY}>
                {t('view')}
              </Link>
            ))}
          <Button onClick={next} className="h-10 rounded-xl px-5 text-sm font-bold">
            {!isLast ? t('next') : current.kind === 'welcome' ? t('start') : t('gotIt')}
          </Button>
        </footer>
      </div>
    </div>
  );
}

const SECONDARY = 'inline-flex h-10 items-center rounded-xl border border-[rgba(120,60,20,.15)] px-4 text-sm font-semibold text-stone-700 hover:bg-stone-50';

function MessageButton({ sender, busy, onClick, label }: { sender: GreetingSender; busy: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} disabled={busy} className={`${SECONDARY} gap-1.5 disabled:opacity-60`} title={sender.name}>
      <MaterialIcon name="chat" size={16} />
      {label}
    </button>
  );
}

function RoleBadge({ role }: { role: 'owner' | 'admin' | 'mod' }) {
  const { t } = useTranslation('community-greetings');
  return <span className="rounded-md bg-brand/10 px-1.5 py-0.5 text-[11px] font-semibold text-brand">{t(`roles.${role}`)}</span>;
}

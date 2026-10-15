import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { MaterialIcon } from '../../components/ui/MaterialIcon';
import { useAuth } from '../auth/AuthContext';
import { Avatar } from '../account/components/Avatar';
import { RichText } from '../chatbot/ChatWidget';
import { useStartConversation } from '../messages/useStartConversation';
import { markAnnouncementSeen, markWelcomeSeen, usePendingGreetings, type GreetingSender } from './api';

/**
 * Popup ở trang cộng đồng: lời chào thành viên mới (1 lần duy nhất / người / cộng đồng) rồi tới thông báo mới nhất của chủ
 * (1 lần / người). Đánh dấu "đã xem" ngay khi hiện => tải lại trang không hiện lại. Mỗi lần chỉ 1 popup.
 */
export function GreetingPopup({ communityId }: { communityId: string }) {
  const { t, i18n } = useTranslation('community-greetings');
  const { user } = useAuth();
  const { data } = usePendingGreetings(communityId);
  const [closed, setClosed] = useState<string[]>([]);
  const marked = useRef(new Set<string>());
  const { startConversation, pendingUserId, error } = useStartConversation();

  const welcome = data?.welcome && !closed.includes('welcome') ? data.welcome : null;
  const announcement = !welcome && data?.announcement && !closed.includes(data.announcement.id) ? data.announcement : null;
  const shownKey = welcome ? 'welcome' : announcement?.id;

  useEffect(() => {
    if (!shownKey || marked.current.has(shownKey)) return;
    marked.current.add(shownKey);
    void (shownKey === 'welcome' ? markWelcomeSeen(communityId) : markAnnouncementSeen(communityId, shownKey)).catch(() => undefined);
  }, [shownKey, communityId]);

  useEffect(() => {
    if (!shownKey) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setClosed((c) => [...c, shownKey]);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shownKey]);

  if (!shownKey) return null;
  const close = () => setClosed((c) => [...c, shownKey]);
  const sender = (welcome ?? announcement)!.sender;
  const date = announcement ? new Date(announcement.createdAt).toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'vi-VN', { day: 'numeric', month: 'long' }) : null;
  const external = announcement?.link?.startsWith('https://');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-[2px]" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={welcome ? t('welcomeLabel') : announcement!.title}
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
              <MaterialIcon name={welcome ? 'waving_hand' : 'campaign'} size={14} />
              {welcome ? t('welcomeLabel') : t('announcementLabel', { date })}
            </p>
          </div>
          <button type="button" onClick={close} aria-label={t('close')} className="grid size-9 place-items-center rounded-xl text-stone-500 hover:bg-stone-100">
            <MaterialIcon name="close" size={20} />
          </button>
        </header>

        <div className="overflow-y-auto px-5 py-4 text-[14.5px] leading-relaxed text-stone-800">
          {announcement && <h2 className="mt-0 mb-2 text-lg font-extrabold text-stone-900">{announcement.title}</h2>}
          <RichText text={welcome ? welcome.message : announcement!.body} />
        </div>

        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-stone-100 px-5 py-3">
          {error && <p className="m-0 mr-auto text-xs text-red-600">{error}</p>}
          {welcome && sender.id && sender.id !== user?.id && (
            <MessageButton sender={sender} busy={pendingUserId === sender.id} onClick={() => void startConversation(sender.id!)} label={t('reply', { name: sender.name })} />
          )}
          {announcement?.link &&
            (external ? (
              <a href={announcement.link} target="_blank" rel="noopener noreferrer" onClick={close} className={SECONDARY}>
                {t('view')}
              </a>
            ) : (
              <Link to={announcement.link} onClick={close} className={SECONDARY}>
                {t('view')}
              </Link>
            ))}
          <Button onClick={close} className="h-10 rounded-xl px-5 text-sm font-bold">
            {welcome ? t('start') : t('gotIt')}
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

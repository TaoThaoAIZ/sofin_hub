import { useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../auth/AuthContext';
import { RichText } from '../chatbot/ChatWidget';
import { ErrorLine, errorText, INPUT_CLASS } from '../communities/components/Modal';
import { greetingKeys, publishAnnouncement, saveWelcome, setAnnouncementActive, useGreetingSettings, type GreetingSettings } from './api';

/** Tab "Lời chào & thông báo" trong Cài đặt cộng đồng (admin trở lên). */
export function GreetingsSettingsTab({ communityId, communityTitle }: { communityId: string; communityTitle: string }) {
  const { t } = useTranslation('community-greetings');
  const q = useGreetingSettings(communityId);
  if (q.isPending) return <p className="py-10 text-center text-stone-500">{t('loading')}</p>;
  if (q.error || !q.data) return <ErrorLine>{errorText(q.error)}</ErrorLine>;
  return (
    <div className="flex flex-col gap-5">
      <WelcomeSection key={JSON.stringify(q.data.welcome)} communityId={communityId} communityTitle={communityTitle} data={q.data} />
      <AnnouncementSection communityId={communityId} data={q.data} />
    </div>
  );
}

const SECTION = 'glass flex flex-col gap-4 rounded-[26px] p-6';

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13.5px] font-semibold text-stone-800">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-stone-500">{hint}</span>}
    </label>
  );
}

/** Lưu xong => cập nhật cache cài đặt; trả lỗi dạng chữ. */
function useSave(communityId: string) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const run = async (fn: () => Promise<GreetingSettings>) => {
    setBusy(true);
    setErr(null);
    try {
      qc.setQueryData(greetingKeys.settings(communityId), await fn());
      return true;
    } catch (e) {
      setErr(errorText(e));
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, err, run };
}

function Preview({ children }: { children: ReactNode }) {
  const { t } = useTranslation('community-greetings');
  return (
    <div className="rounded-2xl border border-dashed border-brand/30 bg-white/70 px-4 py-3 text-[14px] leading-relaxed text-stone-800">
      <p className="mt-0 mb-1.5 text-xs font-semibold tracking-wide text-stone-500 uppercase">{t('preview')}</p>
      {children}
    </div>
  );
}

function WelcomeSection({ communityId, communityTitle, data }: { communityId: string; communityTitle: string; data: GreetingSettings }) {
  const { t } = useTranslation('community-greetings');
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(data.welcome.enabled);
  const [message, setMessage] = useState(data.welcome.message);
  const [saved, setSaved] = useState(false);
  const { busy, err, run } = useSave(communityId);
  const dirty = enabled !== data.welcome.enabled || message !== data.welcome.message;
  const preview = message.replace(/\{ten\}/g, user?.firstName ?? t('sampleName')).replace(/\{cong_dong\}/g, communityTitle);

  return (
    <section className={SECTION}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 text-lg font-extrabold">{t('welcomeTitle')}</h2>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={enabled} onChange={(e) => (setSaved(false), setEnabled(e.target.checked))} className="size-4 accent-brand" />
          {enabled ? t('on') : t('off')}
        </label>
      </div>
      <p className="m-0 text-sm text-stone-600">{t('welcomeIntro')}</p>
      <Field label={t('welcomeMessage')} hint={t('welcomeHint')}>
        <textarea
          className={`${INPUT_CLASS} min-h-[140px] resize-y`}
          value={message}
          maxLength={2000}
          placeholder={t('welcomePlaceholder')}
          onChange={(e) => (setSaved(false), setMessage(e.target.value))}
        />
      </Field>
      {message.trim() && (
        <Preview>
          <RichText text={preview} />
        </Preview>
      )}
      {err && <ErrorLine>{err}</ErrorLine>}
      <div className="flex items-center gap-3">
        <Button disabled={busy || !dirty} onClick={() => void run(() => saveWelcome(communityId, { enabled, message: message.trim() })).then((ok) => ok && setSaved(true))} className="h-10 rounded-xl px-5 text-sm font-bold">
          {t('save')}
        </Button>
        {saved && <span className="text-sm text-emerald-700">{t('saved')}</span>}
      </div>
    </section>
  );
}

function AnnouncementSection({ communityId, data }: { communityId: string; data: GreetingSettings }) {
  const { t, i18n } = useTranslation('community-greetings');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [link, setLink] = useState('');
  const { busy, err, run } = useSave(communityId);
  const fmt = (iso: string) => new Date(iso).toLocaleString(i18n.language === 'en' ? 'en-US' : 'vi-VN', { dateStyle: 'medium', timeStyle: 'short' });

  const publish = () =>
    void run(() => publishAnnouncement(communityId, { title: title.trim(), body: body.trim(), link: link.trim() || null })).then((ok) => {
      if (!ok) return;
      setTitle('');
      setBody('');
      setLink('');
    });

  return (
    <section className={SECTION}>
      <h2 className="m-0 text-lg font-extrabold">{t('announceTitle')}</h2>
      <p className="m-0 text-sm text-stone-600">{t('announceIntro')}</p>
      <Field label={t('annTitle')}>
        <input className={INPUT_CLASS} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder={t('annTitlePlaceholder')} />
      </Field>
      <Field label={t('annBody')} hint={t('annBodyHint')}>
        <textarea className={`${INPUT_CLASS} min-h-[110px] resize-y`} value={body} maxLength={2000} onChange={(e) => setBody(e.target.value)} />
      </Field>
      <Field label={t('annLink')} hint={t('annLinkHint')}>
        <input className={INPUT_CLASS} value={link} maxLength={500} onChange={(e) => setLink(e.target.value)} placeholder="/communities/…/community/lich" />
      </Field>
      {(title.trim() || body.trim()) && (
        <Preview>
          {title.trim() && <p className="mt-0 mb-1.5 text-base font-extrabold text-stone-900">{title}</p>}
          <RichText text={body} />
        </Preview>
      )}
      {err && <ErrorLine>{err}</ErrorLine>}
      <div>
        <Button disabled={busy || !title.trim() || !body.trim()} onClick={publish} className="h-10 rounded-xl px-5 text-sm font-bold">
          {t('publish')}
        </Button>
        <p className="mt-1.5 mb-0 text-xs text-stone-500">{t('publishHint')}</p>
      </div>

      {data.announcements.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="m-0 mt-2 text-[15px] font-bold">{t('history')}</h3>
          {data.announcements.map((a) => (
            <div key={a.id} className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-[rgba(120,60,20,.1)] bg-white/70 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="m-0 flex flex-wrap items-center gap-2 text-sm font-bold">
                  {a.title}
                  <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${a.active ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>
                    {a.active ? t('active') : t('inactive')}
                  </span>
                </p>
                <p className="m-0 mt-0.5 text-xs text-stone-500">
                  {t('meta', { author: a.author, date: fmt(a.createdAt), seen: a.seenCount, members: data.members })}
                  {a.postLink && (
                    <>
                      {' · '}
                      <Link to={a.postLink} className="font-semibold text-brand hover:underline">
                        {t('viewPost')}
                      </Link>
                    </>
                  )}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(() => setAnnouncementActive(communityId, a.id, !a.active))}
                className="h-8 rounded-lg border border-[rgba(120,60,20,.15)] px-3 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-60"
              >
                {a.active ? t('takeDown') : t('reshow')}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

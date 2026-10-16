import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, apiGet } from '../../../lib/api';
import { formatDateTime } from '../../../lib/datetime';
import { useToast } from '../components/overlay';
import { AdminButton, CARD_CLS, ErrorBlock, LoadingBlock, MONO_FONT, StatusBadge, errMessage } from '../components/ui';
import { useAdminAction } from '../queries.batch2';

/**
 * Tài khoản ChatGPT mà chatbot dùng (Codex SDK). Đăng nhập bằng MÃ THIẾT BỊ: server không mở trình duyệt; admin copy link + mã,
 * mở trên máy bất kỳ để xác nhận. Chỉ Super Admin (API /admin/system/chatbot-account). Không bao giờ hiện token.
 */
interface AccountState {
  loggedIn: boolean;
  email: string | null;
  plan: string | null;
  codexHome: string;
  pending: { url: string; code: string; startedAt: string; expiresAt: string } | null;
  lastResult: { at: string; ok: boolean; message: string } | null;
}

const PATH = '/system/chatbot-account';
const KEY = ['admin', 'chatbot-account'] as const;

export function ChatbotAccountCard() {
  const { t } = useTranslation('admin-chatbot');
  const toast = useToast();
  const qc = useQueryClient();
  const act = useAdminAction();
  const q = useQuery({
    queryKey: KEY,
    queryFn: ({ signal }) => apiGet<{ data: AccountState }>(`/admin${PATH}`, undefined, signal).then((r) => r.data),
    // Đang chờ xác nhận mã thì hỏi lại mỗi 3s để biết lúc đăng nhập xong.
    refetchInterval: (query) => (query.state.data?.pending ? 3000 : false),
    retry: (n, e) => !(e instanceof ApiError && e.status === 403) && n < 2,
  });
  const s = q.data;

  // Báo khi đăng nhập xong (pending -> không còn pending + đã đăng nhập).
  const wasPending = useRef(false);
  useEffect(() => {
    if (!s) return;
    if (wasPending.current && !s.pending) {
      if (s.loggedIn && s.lastResult?.ok) toast.success(t('account.toast.loggedIn', { email: s.email ?? 'ChatGPT' }));
      else if (s.lastResult && !s.lastResult.ok) toast.error(s.lastResult.message);
      void qc.invalidateQueries({ queryKey: ['admin', 'chatbot'] });
    }
    wasPending.current = Boolean(s.pending);
  }, [s, t, toast, qc]);

  const run = (path: string, ok?: string) =>
    act.mutateAsync({ path: `${PATH}${path}`, body: {} }).then(
      (data) => {
        qc.setQueryData(KEY, data as AccountState);
        if (ok) toast.success(ok);
      },
      (e) => toast.error(errMessage(e)),
    );

  if (q.isPending) return <LoadingBlock />;
  if (q.isError) {
    if (q.error instanceof ApiError && q.error.status === 403) {
      return <div className={`${CARD_CLS} p-5 text-[13.5px] text-stone-600`}>{t('account.superOnly')}</div>;
    }
    return <ErrorBlock error={q.error} onRetry={() => void q.refetch()} />;
  }
  if (!s) return null;

  return (
    <section className={`${CARD_CLS} flex flex-col gap-3.5 p-5`} aria-label={t('account.title')}>
      <div className="flex flex-wrap items-center gap-2.5">
        <h3 className="m-0 text-[15px] font-bold">{t('account.title')}</h3>
        {s.loggedIn ? <StatusBadge tone="g">{t('account.loggedIn')}</StatusBadge> : <StatusBadge tone="r">{t('account.loggedOut')}</StatusBadge>}
      </div>
      {s.loggedIn && (
        <p className="m-0 text-[13.5px] text-stone-700">
          {t('account.as')} <b>{s.email ?? '—'}</b>
          {s.plan ? ` · ${t('account.plan')} ${s.plan}` : ''}
        </p>
      )}
      <p className="m-0 text-[12.5px] text-stone-500">{t('account.hint')}</p>

      {s.pending ? (
        <div className="flex flex-col gap-3 rounded-2xl border-[1.5px] border-brand/30 bg-[#fff8f2] p-4">
          <ol className="m-0 flex list-decimal flex-col gap-2.5 pl-5 text-[13.5px] text-stone-700">
            <li>
              {t('account.step1')}
              <CopyRow value={s.pending.url} />
            </li>
            <li>
              {t('account.step2')}
              <CopyRow value={s.pending.code} big />
            </li>
            <li>{t('account.step3')}</li>
          </ol>
          <p className="m-0 text-[12.5px] text-stone-500">
            {t('account.expires', { time: formatDateTime(s.pending.expiresAt) })} · {t('account.waiting')}
          </p>
          <p className="m-0 rounded-xl bg-white px-3 py-2 text-[12.5px] text-stone-600">
            {t('account.deviceHelp')}{' '}
            <a href="https://chatgpt.com/#settings/Security" target="_blank" rel="noopener noreferrer" className="font-semibold text-brand underline">
              {t('account.securityLink')}
            </a>
          </p>
          <div>
            <AdminButton onClick={() => void run('/login/cancel')} disabled={act.isPending}>
              {t('account.cancel')}
            </AdminButton>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2.5">
          <AdminButton kind="primary" icon="key" onClick={() => void run('/login')} disabled={act.isPending}>
            {act.isPending ? t('account.starting') : s.loggedIn ? t('account.relogin') : t('account.login')}
          </AdminButton>
          {s.loggedIn && (
            <AdminButton kind="danger" icon="logout" onClick={() => window.confirm(t('account.logoutConfirm')) && void run('/logout', t('account.toast.loggedOut'))} disabled={act.isPending}>
              {t('account.logout')}
            </AdminButton>
          )}
        </div>
      )}
      {s.lastResult && !s.lastResult.ok && !s.pending && (
        <p role="alert" className="m-0 rounded-xl bg-[#fef2f2] px-3 py-2 text-[12.5px] text-[#b91c1c]">
          {t('account.lastError', { time: formatDateTime(s.lastResult.at) })}: {s.lastResult.message}
        </p>
      )}
    </section>
  );
}

function CopyRow({ value, big }: { value: string; big?: boolean }) {
  const { t } = useTranslation('admin-chatbot');
  const [copied, setCopied] = useState(false);
  const copy = () =>
    void navigator.clipboard?.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  return (
    <div className="mt-1.5 flex items-center gap-2">
      <code
        className={`min-w-0 flex-1 truncate rounded-lg border border-[#e7e0da] bg-white px-3 py-2 select-all ${big ? 'text-[18px] font-bold tracking-[.15em]' : 'text-[13px]'}`}
        style={{ fontFamily: MONO_FONT }}
        title={value}
      >
        {value}
      </code>
      <AdminButton icon={copied ? 'check' : 'content_copy'} onClick={copy}>
        {copied ? t('account.copied') : t('account.copy')}
      </AdminButton>
    </div>
  );
}

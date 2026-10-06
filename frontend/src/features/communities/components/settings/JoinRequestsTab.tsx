import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { currentLocale } from '../../../../i18n';
import { Button } from '../../../../components/ui/Button';
import { useDecideJoinRequest, useJoinRequests } from '../../queries';
import type { JoinRequestStatus } from '../../types';
import { errorText } from '../Modal';

const FILTERS: JoinRequestStatus[] = ['pending', 'approved', 'rejected'];

export function JoinRequestsTab({ courseId, isPrivate }: { courseId: string; isPrivate: boolean }) {
  const { t } = useTranslation('communities');
  const [status, setStatus] = useState<JoinRequestStatus>('pending');
  const list = useJoinRequests(courseId, status, true);
  const decide = useDecideJoinRequest(courseId);
  const [actingId, setActingId] = useState<string | null>(null);

  const act = (requestId: string, action: 'approve' | 'reject') => {
    setActingId(requestId);
    decide.mutate({ requestId, action }, { onSettled: () => setActingId(null) });
  };

  return (
    <section className="glass flex flex-col gap-4 rounded-[26px] p-6">
      <h2 className="m-0 text-lg font-extrabold">{t('joinRequests.title')}</h2>
      {!isPrivate && (
        <p className="rounded-xl bg-stone-900/5 px-3.5 py-2.5 text-sm text-stone-600">
          {t('joinRequests.publicNote')}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setStatus(f)}
            className={`h-9 rounded-xl border px-4 text-[13.5px] ${
              status === f ? 'border-transparent bg-brand font-bold text-white' : 'border-[rgba(120,60,20,.12)] bg-white font-medium text-stone-800'
            }`}
          >
            {t(`joinRequests.${f}`)}
          </button>
        ))}
      </div>

      {list.isPending && <p className="text-sm text-stone-500">{t('joinRequests.loading')}</p>}
      {list.isError && <p className="text-sm text-red-600">{errorText(list.error)}</p>}
      {list.data?.length === 0 && <p className="py-4 text-center text-sm text-stone-500">{t('joinRequests.empty')}</p>}
      {decide.isError && <p className="text-sm font-medium text-red-600">{errorText(decide.error)}</p>}

      <div className="flex flex-col gap-3">
        {list.data?.map((r) => (
          <div key={r.id} className="rounded-2xl border border-white/95 bg-white/75 p-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <b className="text-sm">{r.user.name}</b>
              <span className="text-xs text-stone-400">{new Date(r.createdAt).toLocaleString(currentLocale())}</span>
              <span className="ml-auto rounded-md bg-stone-900/5 px-2 py-0.5 text-xs font-medium text-stone-600">{t(`joinRequests.${r.status}`)}</span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-stone-700 break-words">{r.message || <i className="text-stone-400">{t('joinRequests.noMessage')}</i>}</p>
            {r.status === 'pending' && (
              <div className="mt-3 flex gap-2">
                <Button onClick={() => act(r.id, 'approve')} disabled={actingId === r.id} className="h-9 rounded-lg px-4 text-[13px] font-bold">
                  {t('joinRequests.approve')}
                </Button>
                <button
                  type="button"
                  onClick={() => act(r.id, 'reject')}
                  disabled={actingId === r.id}
                  className="h-9 rounded-lg border border-red-200 px-4 text-[13px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  {t('joinRequests.reject')}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

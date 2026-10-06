import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { Pager } from '../../../components/ui/Pager';
import { ApiError } from '../../../lib/api';
import i18n from '../../../i18n';
import { formatCents, formatDateTime } from '../../../lib/datetime';
import type { PayoutStatus, RefundStatus } from '../../payments/types';
import { useAdminPayouts, useAdminRefunds, useLockCommunity, useResolvePayout, useResolveRefund } from '../queries';

const errText = (e: unknown) => (e instanceof ApiError ? e.message : i18n.t('ui.genericError', { ns: 'admin-components' }));

function NoteDialog({
  title,
  confirmLabel,
  danger,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  title: string;
  confirmLabel: string;
  danger?: boolean;
  pending: boolean;
  error: string | null;
  onConfirm: (note: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation('admin-components');
  const [note, setNote] = useState('');
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full max-w-[420px] rounded-3xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-extrabold">{title}</h2>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder={t('tabs.notePh')}
          className="mt-3 w-full resize-none rounded-xl border border-[rgba(120,60,20,.12)] px-3 py-2 text-[14px] outline-0 focus:border-brand"
        />
        {error && <div role="alert" className="mt-2 rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-red-600">{error}</div>}
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 rounded-xl border border-[rgba(120,60,20,.12)] px-4 text-[13px] font-medium">
            {t('tabs.cancel')}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => onConfirm(note.trim())}
            className={`h-10 rounded-xl px-4 text-[13px] font-bold text-white disabled:opacity-60 ${danger ? 'bg-red-600' : 'bg-brand'}`}
          >
            {pending ? t('tabs.processing') : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusFilter<T extends string>({ value, options, onChange }: { value: T | ''; options: { key: T | ''; label: string }[]; onChange: (v: T | '') => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={`h-9 rounded-xl border px-3.5 text-[13px] ${value === o.key ? 'border-transparent bg-brand font-bold text-white' : 'border-[rgba(120,60,20,.12)] bg-white font-medium'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}


export function RefundsTab() {
  const { t } = useTranslation('admin-components');
  const [status, setStatus] = useState<RefundStatus | ''>('pending');
  const [page, setPage] = useState(1);
  const list = useAdminRefunds(status || undefined, page);
  const resolve = useResolveRefund();
  const [target, setTarget] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <StatusFilter
        value={status}
        onChange={(v) => {
          setStatus(v);
          setPage(1);
        }}
        options={[
          { key: 'pending', label: t('tabs.refund.pending') },
          { key: 'approved', label: t('tabs.refund.approved') },
          { key: 'rejected', label: t('tabs.refund.rejected') },
          { key: '', label: t('tabs.all') },
        ]}
      />
      <div className="glass mt-3 overflow-hidden rounded-3xl">
        {list.isPending && <p className="py-10 text-center text-stone-400">{t('tabs.loading')}</p>}
        {list.isError && <p className="py-10 text-center text-red-600">{errText(list.error)}</p>}
        {list.data?.data.length === 0 && <p className="py-10 text-center text-stone-500">{t('tabs.refund.empty')}</p>}
        {list.data?.data.map((r) => (
          <div key={r.id} className="border-b border-[rgba(120,60,20,.06)] px-4 py-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[15px] font-bold">{formatCents(r.amountCents)}</span>
              <span className="rounded-lg bg-stone-900/5 px-2 py-0.5 text-xs font-medium">{t(`tabs.refund.${r.status}`)}</span>
              {r.auto && <span className="rounded-lg bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-700">{t('tabs.refund.auto')}</span>}
              <span className="ml-auto text-[12px] text-stone-500">{formatDateTime(r.createdAt)}</span>
            </div>
            <div className="mt-1 text-[13px] text-stone-700">{t('tabs.refund.reasonLine', { reason: r.reason })}</div>
            <div className="text-[11.5px] break-all text-stone-500">
              {t('tabs.refund.ids', { paymentId: r.paymentId, courseId: r.courseId, userId: r.userId })}
            </div>
            {r.note && <div className="text-[12px] text-stone-500">{t('tabs.refund.noteLine', { note: r.note })}</div>}
            {r.status === 'pending' && (
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => { setError(null); setTarget({ id: r.id, action: 'approve' }); }} className="h-8 rounded-lg bg-brand px-3 text-[12.5px] font-bold text-white">
                  {t('tabs.refund.approveBtn')}
                </button>
                <button type="button" onClick={() => { setError(null); setTarget({ id: r.id, action: 'reject' }); }} className="h-8 rounded-lg border border-[rgba(120,60,20,.12)] bg-white px-3 text-[12.5px] font-medium hover:bg-red-50 hover:text-red-600">
                  {t('tabs.refund.rejectBtn')}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      <Pager page={page} totalPages={list.data?.meta.totalPages ?? 1} onChange={setPage} />
      {target && (
        <NoteDialog
          title={target.action === 'approve' ? t('tabs.refund.approveTitle') : t('tabs.refund.rejectTitle')}
          confirmLabel={target.action === 'approve' ? t('tabs.refund.approveConfirm') : t('tabs.refund.rejectBtn')}
          danger={target.action === 'reject'}
          pending={resolve.isPending}
          error={error}
          onClose={() => setTarget(null)}
          onConfirm={(note) => {
            setError(null);
            resolve.mutate({ ...target, note: note || undefined }, { onSuccess: () => setTarget(null), onError: (e) => setError(errText(e)) });
          }}
        />
      )}
    </div>
  );
}

export function PayoutsTab() {
  const { t } = useTranslation('admin-components');
  const [status, setStatus] = useState<PayoutStatus | ''>('requested');
  const [page, setPage] = useState(1);
  const list = useAdminPayouts(status || undefined, page);
  const resolve = useResolvePayout();
  const [target, setTarget] = useState<{ id: string; action: 'approve' | 'mark_paid' | 'reject' } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const open = (id: string, action: 'approve' | 'mark_paid' | 'reject') => {
    setError(null);
    setTarget({ id, action });
  };
  const TITLES = { approve: t('tabs.payout.titleApprove'), mark_paid: t('tabs.payout.titleMarkPaid'), reject: t('tabs.payout.titleReject') } as const;

  return (
    <div>
      <StatusFilter
        value={status}
        onChange={(v) => {
          setStatus(v);
          setPage(1);
        }}
        options={[
          { key: 'requested', label: t('tabs.payout.requested') },
          { key: 'approved', label: t('tabs.payout.approved') },
          { key: 'paid', label: t('tabs.payout.paid') },
          { key: 'rejected', label: t('tabs.payout.rejected') },
          { key: '', label: t('tabs.all') },
        ]}
      />
      <div className="glass mt-3 overflow-hidden rounded-3xl">
        {list.isPending && <p className="py-10 text-center text-stone-400">{t('tabs.loading')}</p>}
        {list.isError && <p className="py-10 text-center text-red-600">{errText(list.error)}</p>}
        {list.data?.data.length === 0 && <p className="py-10 text-center text-stone-500">{t('tabs.payout.empty')}</p>}
        {list.data?.data.map((p) => (
          <div key={p.id} className="border-b border-[rgba(120,60,20,.06)] px-4 py-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[15px] font-bold">{formatCents(p.amountCents)}</span>
              <span className="rounded-lg bg-stone-900/5 px-2 py-0.5 text-xs font-medium">{t(`tabs.payout.${p.status}`)}</span>
              <span className="ml-auto text-[12px] text-stone-500">{formatDateTime(p.createdAt)}</span>
            </div>
            <div className="mt-1 text-[13px] text-stone-700">
              {p.method.bankName} · {p.method.accountMasked ?? `****${p.method.accountLast4 ?? ''}`} · {p.method.accountHolder}
            </div>
            <div className="text-[11.5px] break-all text-stone-500">
              {t('tabs.payout.ids', { courseId: p.courseId, ownerId: p.ownerId })}
            </div>
            {p.note && <div className="text-[12px] text-stone-500">{t('tabs.refund.noteLine', { note: p.note })}</div>}
            <div className="mt-2 flex flex-wrap gap-2">
              {p.status === 'requested' && (
                <button type="button" onClick={() => open(p.id, 'approve')} className="h-8 rounded-lg bg-brand px-3 text-[12.5px] font-bold text-white">
                  {t('tabs.payout.approveBtn')}
                </button>
              )}
              {p.status === 'approved' && (
                <button type="button" onClick={() => open(p.id, 'mark_paid')} className="h-8 rounded-lg bg-green-600 px-3 text-[12.5px] font-bold text-white">
                  {t('tabs.payout.markPaidBtn')}
                </button>
              )}
              {(p.status === 'requested' || p.status === 'approved') && (
                <button type="button" onClick={() => open(p.id, 'reject')} className="h-8 rounded-lg border border-[rgba(120,60,20,.12)] bg-white px-3 text-[12.5px] font-medium hover:bg-red-50 hover:text-red-600">
                  {t('tabs.payout.rejectBtn')}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <Pager page={page} totalPages={list.data?.meta.totalPages ?? 1} onChange={setPage} />
      {target && (
        <NoteDialog
          title={TITLES[target.action]}
          confirmLabel={t('tabs.confirm')}
          danger={target.action === 'reject'}
          pending={resolve.isPending}
          error={error}
          onClose={() => setTarget(null)}
          onConfirm={(note) => {
            setError(null);
            resolve.mutate({ ...target, note: note || undefined }, { onSuccess: () => setTarget(null), onError: (e) => setError(errText(e)) });
          }}
        />
      )}
    </div>
  );
}

export function LockTab() {
  const { t } = useTranslation('admin-components');
  const lock = useLockCommunity();
  const [courseId, setCourseId] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const run = (e: FormEvent | null, doLock: boolean) => {
    e?.preventDefault();
    setMessage(null);
    const id = courseId.trim();
    if (!id) return setMessage({ ok: false, text: t('tabs.lock.needId') });
    if (doLock && reason.trim().length < 3) return setMessage({ ok: false, text: t('tabs.lock.needReason') });
    lock.mutate(
      { courseId: id, lock: doLock, reason: reason.trim() },
      {
        onSuccess: () => setMessage({ ok: true, text: doLock ? t('tabs.lock.locked', { id }) : t('tabs.lock.unlocked', { id }) }),
        onError: (err) => setMessage({ ok: false, text: errText(err) }),
      },
    );
  };

  return (
    <form onSubmit={(e) => run(e, true)} className="glass grid max-w-[560px] gap-3 rounded-3xl p-5">
      <p className="flex items-start gap-2 text-[13px] text-stone-600">
        <MaterialIcon name="info" size={17} />
        {t('tabs.lock.info')}
      </p>
      <label className="text-[12.5px] font-semibold">
        {t('tabs.lock.idLabel')}
        <input value={courseId} onChange={(e) => setCourseId(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-[rgba(120,60,20,.12)] px-3 text-[14px] outline-0 focus:border-brand" />
      </label>
      <label className="text-[12.5px] font-semibold">
        {t('tabs.lock.reasonLabel')}
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} className="mt-1 w-full resize-none rounded-xl border border-[rgba(120,60,20,.12)] px-3 py-2 text-[14px] outline-0 focus:border-brand" />
      </label>
      {message && (
        <div role="alert" className={`rounded-xl px-4 py-2 text-sm font-medium ${message.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
          {message.text}
        </div>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={lock.isPending} className="h-11 rounded-xl bg-red-600 px-5 text-[14px] font-bold text-white disabled:opacity-60">
          {t('tabs.lock.lockBtn')}
        </button>
        <button type="button" disabled={lock.isPending} onClick={() => run(null, false)} className="h-11 rounded-xl border border-[rgba(120,60,20,.12)] bg-white px-5 text-[14px] font-medium disabled:opacity-60">
          {t('tabs.lock.unlockBtn')}
        </button>
      </div>
    </form>
  );
}

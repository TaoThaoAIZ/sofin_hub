import { useState, type FormEvent } from 'react';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { Pager } from '../../../components/ui/Pager';
import { ApiError } from '../../../lib/api';
import { formatCents, formatDateTime } from '../../../lib/datetime';
import type { PayoutStatus, RefundStatus } from '../../payments/types';
import { useAdminPayouts, useAdminRefunds, useLockCommunity, useResolvePayout, useResolveRefund } from '../queries';

const errText = (e: unknown) => (e instanceof ApiError ? e.message : 'Đã có lỗi xảy ra, vui lòng thử lại');

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
          placeholder="Ghi chú (tùy chọn)…"
          className="mt-3 w-full resize-none rounded-xl border border-[rgba(120,60,20,.12)] px-3 py-2 text-[14px] outline-0 focus:border-brand"
        />
        {error && <div role="alert" className="mt-2 rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-red-600">{error}</div>}
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 rounded-xl border border-[rgba(120,60,20,.12)] px-4 text-[13px] font-medium">
            Hủy
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => onConfirm(note.trim())}
            className={`h-10 rounded-xl px-4 text-[13px] font-bold text-white disabled:opacity-60 ${danger ? 'bg-red-600' : 'bg-brand'}`}
          >
            {pending ? 'Đang xử lý…' : confirmLabel}
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

const REFUND_STATUS: Record<RefundStatus, string> = { pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Từ chối' };
const PAYOUT_STATUS: Record<PayoutStatus, string> = { requested: 'Đã yêu cầu', approved: 'Đã duyệt', paid: 'Đã chi trả', rejected: 'Từ chối' };

export function RefundsTab() {
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
          { key: 'pending', label: 'Chờ duyệt' },
          { key: 'approved', label: 'Đã duyệt' },
          { key: 'rejected', label: 'Từ chối' },
          { key: '', label: 'Tất cả' },
        ]}
      />
      <div className="glass mt-3 overflow-hidden rounded-3xl">
        {list.isPending && <p className="py-10 text-center text-stone-400">Đang tải…</p>}
        {list.isError && <p className="py-10 text-center text-red-600">{errText(list.error)}</p>}
        {list.data?.data.length === 0 && <p className="py-10 text-center text-stone-500">Không có yêu cầu hoàn tiền.</p>}
        {list.data?.data.map((r) => (
          <div key={r.id} className="border-b border-[rgba(120,60,20,.06)] px-4 py-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[15px] font-bold">{formatCents(r.amountCents)}</span>
              <span className="rounded-lg bg-stone-900/5 px-2 py-0.5 text-xs font-medium">{REFUND_STATUS[r.status]}</span>
              {r.auto && <span className="rounded-lg bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-700">Tự duyệt</span>}
              <span className="ml-auto text-[12px] text-stone-500">{formatDateTime(r.createdAt)}</span>
            </div>
            <div className="mt-1 text-[13px] text-stone-700">Lý do: {r.reason}</div>
            <div className="text-[11.5px] break-all text-stone-500">
              Giao dịch {r.paymentId} · Cộng đồng {r.courseId} · Người dùng {r.userId}
            </div>
            {r.note && <div className="text-[12px] text-stone-500">Ghi chú: {r.note}</div>}
            {r.status === 'pending' && (
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => { setError(null); setTarget({ id: r.id, action: 'approve' }); }} className="h-8 rounded-lg bg-brand px-3 text-[12.5px] font-bold text-white">
                  Duyệt hoàn tiền
                </button>
                <button type="button" onClick={() => { setError(null); setTarget({ id: r.id, action: 'reject' }); }} className="h-8 rounded-lg border border-[rgba(120,60,20,.12)] bg-white px-3 text-[12.5px] font-medium hover:bg-red-50 hover:text-red-600">
                  Từ chối
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      <Pager page={page} totalPages={list.data?.meta.totalPages ?? 1} onChange={setPage} />
      {target && (
        <NoteDialog
          title={target.action === 'approve' ? 'Duyệt hoàn tiền' : 'Từ chối hoàn tiền'}
          confirmLabel={target.action === 'approve' ? 'Duyệt' : 'Từ chối'}
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
  const TITLES = { approve: 'Duyệt lệnh rút tiền', mark_paid: 'Đánh dấu đã chi trả', reject: 'Từ chối lệnh rút tiền' } as const;

  return (
    <div>
      <StatusFilter
        value={status}
        onChange={(v) => {
          setStatus(v);
          setPage(1);
        }}
        options={[
          { key: 'requested', label: 'Đã yêu cầu' },
          { key: 'approved', label: 'Đã duyệt' },
          { key: 'paid', label: 'Đã chi trả' },
          { key: 'rejected', label: 'Từ chối' },
          { key: '', label: 'Tất cả' },
        ]}
      />
      <div className="glass mt-3 overflow-hidden rounded-3xl">
        {list.isPending && <p className="py-10 text-center text-stone-400">Đang tải…</p>}
        {list.isError && <p className="py-10 text-center text-red-600">{errText(list.error)}</p>}
        {list.data?.data.length === 0 && <p className="py-10 text-center text-stone-500">Không có lệnh rút tiền.</p>}
        {list.data?.data.map((p) => (
          <div key={p.id} className="border-b border-[rgba(120,60,20,.06)] px-4 py-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[15px] font-bold">{formatCents(p.amountCents)}</span>
              <span className="rounded-lg bg-stone-900/5 px-2 py-0.5 text-xs font-medium">{PAYOUT_STATUS[p.status]}</span>
              <span className="ml-auto text-[12px] text-stone-500">{formatDateTime(p.createdAt)}</span>
            </div>
            <div className="mt-1 text-[13px] text-stone-700">
              {p.method.bankName} · {p.method.accountMasked ?? `****${p.method.accountLast4 ?? ''}`} · {p.method.accountHolder}
            </div>
            <div className="text-[11.5px] break-all text-stone-500">
              Cộng đồng {p.courseId} · Chủ {p.ownerId}
            </div>
            {p.note && <div className="text-[12px] text-stone-500">Ghi chú: {p.note}</div>}
            <div className="mt-2 flex flex-wrap gap-2">
              {p.status === 'requested' && (
                <button type="button" onClick={() => open(p.id, 'approve')} className="h-8 rounded-lg bg-brand px-3 text-[12.5px] font-bold text-white">
                  Duyệt
                </button>
              )}
              {p.status === 'approved' && (
                <button type="button" onClick={() => open(p.id, 'mark_paid')} className="h-8 rounded-lg bg-green-600 px-3 text-[12.5px] font-bold text-white">
                  Đã chi trả
                </button>
              )}
              {(p.status === 'requested' || p.status === 'approved') && (
                <button type="button" onClick={() => open(p.id, 'reject')} className="h-8 rounded-lg border border-[rgba(120,60,20,.12)] bg-white px-3 text-[12.5px] font-medium hover:bg-red-50 hover:text-red-600">
                  Từ chối
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
          confirmLabel="Xác nhận"
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
  const lock = useLockCommunity();
  const [courseId, setCourseId] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const run = (e: FormEvent | null, doLock: boolean) => {
    e?.preventDefault();
    setMessage(null);
    const id = courseId.trim();
    if (!id) return setMessage({ ok: false, text: 'Nhập id hoặc slug cộng đồng.' });
    if (doLock && reason.trim().length < 3) return setMessage({ ok: false, text: 'Nhập lý do khóa (tối thiểu 3 ký tự).' });
    lock.mutate(
      { courseId: id, lock: doLock, reason: reason.trim() },
      {
        onSuccess: () => setMessage({ ok: true, text: doLock ? `Đã khóa cộng đồng "${id}".` : `Đã mở khóa cộng đồng "${id}".` }),
        onError: (err) => setMessage({ ok: false, text: errText(err) }),
      },
    );
  };

  return (
    <form onSubmit={(e) => run(e, true)} className="glass grid max-w-[560px] gap-3 rounded-3xl p-5">
      <p className="flex items-start gap-2 text-[13px] text-stone-600">
        <MaterialIcon name="info" size={17} />
        Cộng đồng bị khóa: thành viên không tham gia/đăng bài mới được. Nhập id hoặc slug của cộng đồng (ví dụ phần cuối của đường dẫn /courses/…).
      </p>
      <label className="text-[12.5px] font-semibold">
        Id / slug cộng đồng
        <input value={courseId} onChange={(e) => setCourseId(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-[rgba(120,60,20,.12)] px-3 text-[14px] outline-0 focus:border-brand" />
      </label>
      <label className="text-[12.5px] font-semibold">
        Lý do (bắt buộc khi khóa)
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} className="mt-1 w-full resize-none rounded-xl border border-[rgba(120,60,20,.12)] px-3 py-2 text-[14px] outline-0 focus:border-brand" />
      </label>
      {message && (
        <div role="alert" className={`rounded-xl px-4 py-2 text-sm font-medium ${message.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
          {message.text}
        </div>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={lock.isPending} className="h-11 rounded-xl bg-red-600 px-5 text-[14px] font-bold text-white disabled:opacity-60">
          Khóa cộng đồng
        </button>
        <button type="button" disabled={lock.isPending} onClick={() => run(null, false)} className="h-11 rounded-xl border border-[rgba(120,60,20,.12)] bg-white px-5 text-[14px] font-medium disabled:opacity-60">
          Mở khóa
        </button>
      </div>
    </form>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../components/layout/Header';
import { RequireLogin } from '../components/layout/RequireLogin';
import { MaterialIcon } from '../components/ui/MaterialIcon';
import { Pager } from '../components/ui/Pager';
import { ApiError } from '../lib/api';
import { formatCents, formatDate } from '../lib/datetime';
import { InvoiceDialog } from '../features/payments/components/InvoiceDialog';
import {
  useCancelSubscription,
  useMyPayments,
  useMySubscriptions,
  useRequestRefund,
  useResumeSubscription,
} from '../features/payments/queries';
import type { PaymentRecord, RefundStatus, Subscription } from '../features/payments/types';

const errText = (e: unknown) => (e instanceof ApiError ? e.message : 'Đã có lỗi xảy ra, vui lòng thử lại');

function subLabel(s: Subscription): { text: string; cls: string } {
  if (s.status === 'trialing') return { text: 'Đang dùng thử', cls: 'bg-blue-500/10 text-blue-700' };
  if (s.status === 'active' && s.cancelAtPeriodEnd) return { text: 'Đã hủy — còn truy cập đến hết kỳ', cls: 'bg-amber-500/10 text-amber-700' };
  if (s.status === 'active') return { text: 'Đang hoạt động', cls: 'bg-green-500/10 text-green-700' };
  if (s.status === 'canceled') return { text: 'Đã hủy', cls: 'bg-stone-900/5 text-stone-600' };
  return { text: 'Đã hết hạn', cls: 'bg-red-500/10 text-red-600' };
}

const PAY_LABEL: Record<string, { text: string; cls: string }> = {
  succeeded: { text: 'Thành công', cls: 'bg-green-500/10 text-green-700' },
  pending: { text: 'Đang chờ', cls: 'bg-amber-500/10 text-amber-700' },
  failed: { text: 'Thất bại', cls: 'bg-red-500/10 text-red-600' },
  refunded: { text: 'Đã hoàn tiền', cls: 'bg-stone-900/5 text-stone-600' },
};

const REFUND_LABEL: Record<RefundStatus, string> = {
  pending: 'Yêu cầu hoàn tiền: đang chờ duyệt',
  approved: 'Yêu cầu hoàn tiền: đã duyệt',
  rejected: 'Yêu cầu hoàn tiền: bị từ chối',
};

// BE chưa có endpoint liệt kê yêu cầu hoàn tiền của tôi -> nhớ trạng thái vừa gửi trong trình duyệt để hiển thị lại.
const refundKey = (id: string) => `sofin:refund:${id}`;
function readRefund(id: string): RefundStatus | null {
  try {
    return localStorage.getItem(refundKey(id)) as RefundStatus | null;
  } catch {
    return null;
  }
}
function saveRefund(id: string, s: RefundStatus) {
  try {
    localStorage.setItem(refundKey(id), s);
  } catch {
    /* bỏ qua */
  }
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full max-w-[440px] rounded-3xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Đóng" className="text-stone-500 hover:text-stone-900">
            <MaterialIcon name="close" size={22} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SubscriptionCard({ s }: { s: Subscription }) {
  const cancel = useCancelSubscription();
  const resume = useResumeSubscription();
  const [dialog, setDialog] = useState(false);
  const [atPeriodEnd, setAtPeriodEnd] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const label = subLabel(s);
  const live = s.status === 'active' || s.status === 'trialing';

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <Link to={`/courses/${s.courseId}/community`} className="block truncate text-[15px] font-bold hover:text-brand">
            {s.courseTitle ?? 'Cộng đồng'}
          </Link>
          <div className="text-[12.5px] text-stone-500">
            {formatCents(s.priceCents)}/tháng · Kỳ hiện tại: {formatDate(s.currentPeriodStart)} – {formatDate(s.currentPeriodEnd)}
          </div>
          {s.trialEndsAt && s.status === 'trialing' && <div className="text-[12.5px] text-blue-700">Dùng thử đến {formatDate(s.trialEndsAt)}</div>}
          {s.accessUntil && live && <div className="text-[12.5px] text-stone-500">Truy cập đến {formatDate(s.accessUntil)}</div>}
        </div>
        <span className={`inline-flex h-[26px] items-center rounded-lg px-2.5 text-xs font-medium ${label.cls}`}>{label.text}</span>
      </div>
      {live && (
        <div className="mt-3 flex flex-wrap gap-2">
          {s.cancelAtPeriodEnd ? (
            <button
              type="button"
              disabled={resume.isPending}
              onClick={() => {
                setError(null);
                resume.mutate(s.courseId, { onError: (e) => setError(errText(e)) });
              }}
              className="h-9 rounded-xl bg-brand px-4 text-[13px] font-bold text-white disabled:opacity-60"
            >
              {resume.isPending ? 'Đang xử lý…' : 'Tiếp tục gói'}
            </button>
          ) : (
            <button type="button" onClick={() => setDialog(true)} className="h-9 rounded-xl border border-[rgba(120,60,20,.12)] bg-white px-4 text-[13px] font-medium hover:bg-[#fff7f0]">
              Hủy gói
            </button>
          )}
        </div>
      )}
      {error && <div role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-red-600">{error}</div>}
      {dialog && (
        <Modal title="Hủy gói thành viên" onClose={() => setDialog(false)}>
          <div className="mt-3 flex flex-col gap-2.5">
            {[
              { v: true, t: 'Hủy vào cuối kỳ', d: `Vẫn truy cập đến ${formatDate(s.currentPeriodEnd)}, sau đó không gia hạn.` },
              { v: false, t: 'Hủy ngay', d: 'Mất quyền truy cập cộng đồng ngay lập tức.' },
            ].map((o) => (
              <label key={String(o.v)} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 ${atPeriodEnd === o.v ? 'border-brand bg-brand/5' : 'border-[rgba(120,60,20,.12)]'}`}>
                <input type="radio" name={`cancel-${s.id}`} checked={atPeriodEnd === o.v} onChange={() => setAtPeriodEnd(o.v)} className="mt-1 accent-brand" />
                <span>
                  <span className="block text-[14px] font-semibold">{o.t}</span>
                  <span className="block text-[12.5px] text-stone-500">{o.d}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setDialog(false)} className="h-10 rounded-xl border border-[rgba(120,60,20,.12)] px-4 text-[13px] font-medium">
              Giữ gói
            </button>
            <button
              type="button"
              disabled={cancel.isPending}
              onClick={() => {
                setError(null);
                cancel.mutate({ courseId: s.courseId, atPeriodEnd }, { onSuccess: () => setDialog(false), onError: (e) => { setDialog(false); setError(errText(e)); } });
              }}
              className="h-10 rounded-xl bg-red-600 px-4 text-[13px] font-bold text-white disabled:opacity-60"
            >
              {cancel.isPending ? 'Đang hủy…' : 'Xác nhận hủy'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function RefundDialog({ payment, onClose }: { payment: PaymentRecord; onClose: () => void }) {
  const refund = useRequestRefund();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RefundStatus | null>(null);
  const tooShort = reason.trim().length < 3;

  return (
    <Modal title="Yêu cầu hoàn tiền" onClose={onClose}>
      {result ? (
        <div className="mt-4">
          <div className={`rounded-xl px-4 py-3 text-[14px] font-medium ${result === 'approved' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
            {result === 'approved'
              ? 'Yêu cầu đã được duyệt tự động (trong thời hạn hoàn tiền). Khoản tiền sẽ được hoàn lại.'
              : 'Yêu cầu đã được gửi và đang chờ quản trị viên nền tảng duyệt.'}
          </div>
          <div className="mt-4 flex justify-end">
            <button type="button" onClick={onClose} className="h-10 rounded-xl bg-brand px-5 text-[13px] font-bold text-white">
              Đóng
            </button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            refund.mutate(
              { paymentId: payment.id, reason: reason.trim() },
              {
                onSuccess: (r) => {
                  saveRefund(payment.id, r.status);
                  setResult(r.status);
                },
                onError: (err) => setError(errText(err)),
              },
            );
          }}
        >
          <p className="mt-2 text-[13px] text-stone-500">
            Giao dịch {payment.invoiceNumber ?? payment.id} · {formatCents(payment.amountCents ?? Math.round(payment.amountUsd * 100))}. Trong 7 ngày đầu kể từ lần thanh toán đầu của gói, yêu cầu được duyệt
            tự động; sau đó cần quản trị viên duyệt.
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            maxLength={500}
            placeholder="Lý do hoàn tiền…"
            className="mt-3 w-full resize-none rounded-xl border border-[rgba(120,60,20,.12)] px-3 py-2 text-[14px] outline-0 focus:border-brand"
          />
          {error && <div role="alert" className="mt-2 rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-red-600">{error}</div>}
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="h-10 rounded-xl border border-[rgba(120,60,20,.12)] px-4 text-[13px] font-medium">
              Đóng
            </button>
            <button type="submit" disabled={tooShort || refund.isPending} className="h-10 rounded-xl bg-brand px-4 text-[13px] font-bold text-white disabled:opacity-60">
              {refund.isPending ? 'Đang gửi…' : 'Gửi yêu cầu'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function BillingInner() {
  const subs = useMySubscriptions();
  const [page, setPage] = useState(1);
  const payments = useMyPayments(page);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [refundFor, setRefundFor] = useState<PaymentRecord | null>(null);

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <div className="mx-auto max-w-[900px] px-4 py-8 md:px-0">
        <h1 className="text-2xl font-extrabold">Gói & thanh toán</h1>

        <h2 className="mt-6 mb-3 text-lg font-extrabold">Gói của tôi</h2>
        {subs.isPending && <p className="py-6 text-center text-stone-400">Đang tải…</p>}
        {subs.isError && <p className="py-6 text-center text-red-600">{errText(subs.error)}</p>}
        {subs.data?.length === 0 && <p className="glass rounded-2xl py-8 text-center text-stone-500">Bạn chưa có gói thành viên trả phí hoặc dùng thử nào.</p>}
        <div className="flex flex-col gap-3">{subs.data?.map((s) => <SubscriptionCard key={s.id} s={s} />)}</div>

        <h2 className="mt-8 mb-3 text-lg font-extrabold">Lịch sử thanh toán</h2>
        <div className="glass overflow-x-auto rounded-3xl">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-[rgba(120,60,20,.08)] text-[11.5px] tracking-wide text-stone-500">
                <th className="px-4 py-3 font-semibold">NGÀY</th>
                <th className="px-2 py-3 font-semibold">CỘNG ĐỒNG</th>
                <th className="px-2 py-3 font-semibold">SỐ TIỀN</th>
                <th className="px-2 py-3 font-semibold">TRẠNG THÁI</th>
                <th className="px-4 py-3 text-right font-semibold" />
              </tr>
            </thead>
            <tbody>
              {payments.isPending && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-stone-400">Đang tải…</td>
                </tr>
              )}
              {payments.isError && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-red-600">{errText(payments.error)}</td>
                </tr>
              )}
              {payments.data?.data.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-stone-500">Chưa có giao dịch nào.</td>
                </tr>
              )}
              {payments.data?.data.map((p) => {
                const st = PAY_LABEL[p.status] ?? { text: p.status, cls: 'bg-stone-900/5 text-stone-600' };
                const refundState = readRefund(p.id);
                const canRefund = p.status === 'succeeded' && !(p.refundedCents && p.refundedCents > 0);
                return (
                  <tr key={p.id} className="border-b border-[rgba(120,60,20,.06)]">
                    <td className="px-4 py-3">{formatDate(p.confirmedAt ?? p.createdAt)}</td>
                    <td className="px-2 py-3">
                      <div className="font-semibold">{p.courseTitle ?? p.courseId}</div>
                      <div className="text-[11.5px] text-stone-500">
                        {p.kind === 'renewal' ? 'Gia hạn' : 'Thanh toán đầu'}
                        {p.invoiceNumber ? ` · ${p.invoiceNumber}` : ''}
                      </div>
                    </td>
                    <td className="px-2 py-3">
                      {formatCents(p.amountCents ?? Math.round(p.amountUsd * 100))}
                      {p.refundedCents ? <div className="text-[11.5px] text-red-600">Đã hoàn {formatCents(p.refundedCents)}</div> : null}
                    </td>
                    <td className="px-2 py-3">
                      <span className={`inline-flex h-[24px] items-center rounded-lg px-2 text-xs font-medium ${st.cls}`}>{st.text}</span>
                      {refundState && p.status !== 'refunded' && <div className="mt-1 text-[11.5px] text-stone-500">{REFUND_LABEL[refundState]}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        {p.invoiceNumber && (
                          <button type="button" onClick={() => setInvoiceId(p.id)} className="h-8 rounded-lg border border-[rgba(120,60,20,.12)] bg-white px-2.5 text-[12px] font-medium hover:bg-[#fff7f0]">
                            Hóa đơn
                          </button>
                        )}
                        {canRefund && (
                          <button type="button" onClick={() => setRefundFor(p)} className="h-8 rounded-lg border border-[rgba(120,60,20,.12)] bg-white px-2.5 text-[12px] font-medium hover:bg-[#fff7f0]">
                            Hoàn tiền
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pager page={page} totalPages={payments.data?.meta.totalPages ?? 1} onChange={setPage} />
      </div>
      {invoiceId && <InvoiceDialog paymentId={invoiceId} onClose={() => setInvoiceId(null)} />}
      {refundFor && <RefundDialog payment={refundFor} onClose={() => setRefundFor(null)} />}
    </div>
  );
}

export function BillingPage() {
  return (
    <RequireLogin>
      <BillingInner />
    </RequireLogin>
  );
}

import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Header } from '../components/layout/Header';
import { RequireLogin } from '../components/layout/RequireLogin';
import { MaterialIcon } from '../components/ui/MaterialIcon';
import { Pager } from '../components/ui/Pager';
import { ApiError } from '../lib/api';
import { formatCents, formatDate, formatDateTime } from '../lib/datetime';
import { useCourseDetail } from '../features/courses/queries';
import { usePayouts, useRequestPayout, useRevenue } from '../features/payments/queries';
import type { PayoutStatus } from '../features/payments/types';

const errText = (e: unknown) => (e instanceof ApiError ? e.message : 'Đã có lỗi xảy ra, vui lòng thử lại');

const PAYOUT_LABEL: Record<PayoutStatus, { text: string; cls: string }> = {
  requested: { text: 'Đã yêu cầu', cls: 'bg-amber-500/10 text-amber-700' },
  approved: { text: 'Đã duyệt', cls: 'bg-blue-500/10 text-blue-700' },
  paid: { text: 'Đã chi trả', cls: 'bg-green-500/10 text-green-700' },
  rejected: { text: 'Bị từ chối', cls: 'bg-red-500/10 text-red-600' },
};

function Stat({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="text-[12px] font-semibold text-stone-500">{label}</div>
      <div className={`mt-1 text-[22px] font-extrabold ${accent ? 'text-brand' : ''}`}>{value}</div>
      {hint && <div className="text-[11.5px] text-stone-400">{hint}</div>}
    </div>
  );
}

function PayoutForm({ courseId, available }: { courseId: string; available: number }) {
  const request = useRequestPayout(courseId);
  const [amount, setAmount] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const cents = Math.round(Number(amount) * 100);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setOk(false);
    if (!Number.isFinite(cents) || cents <= 0) return setError('Nhập số tiền hợp lệ (USD).');
    if (cents > available) return setError('Số tiền vượt quá số dư khả dụng.');
    if (!/^\d{6,20}$/.test(accountNumber.trim())) return setError('Số tài khoản phải gồm 6–20 chữ số.');
    request.mutate(
      { amountCents: cents, method: { type: 'bank', bankName: bankName.trim(), accountNumber: accountNumber.trim(), accountHolder: accountHolder.trim() } },
      {
        onSuccess: () => {
          setOk(true);
          setAmount('');
          setAccountNumber('');
        },
        onError: (err) => setError(errText(err)),
      },
    );
  };

  const input = 'h-11 w-full rounded-xl border border-[rgba(120,60,20,.12)] bg-white px-3 text-[14px] outline-0 focus:border-brand';
  return (
    <form onSubmit={submit} className="glass grid gap-3 rounded-3xl p-5 sm:grid-cols-2">
      <h2 className="text-lg font-extrabold sm:col-span-2">Yêu cầu rút tiền</h2>
      <label className="text-[12.5px] font-semibold sm:col-span-2">
        Số tiền (USD) — khả dụng {formatCents(available)}
        <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${input} mt-1`} required />
      </label>
      <label className="text-[12.5px] font-semibold">
        Ngân hàng
        <input value={bankName} onChange={(e) => setBankName(e.target.value)} maxLength={100} className={`${input} mt-1`} required />
      </label>
      <label className="text-[12.5px] font-semibold">
        Số tài khoản
        <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} inputMode="numeric" autoComplete="off" className={`${input} mt-1`} required />
      </label>
      <label className="text-[12.5px] font-semibold sm:col-span-2">
        Chủ tài khoản
        <input value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} maxLength={100} className={`${input} mt-1`} required />
      </label>
      {error && <div role="alert" className="rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-red-600 sm:col-span-2">{error}</div>}
      {ok && <div className="rounded-xl bg-green-50 px-4 py-2 text-sm font-medium text-green-700 sm:col-span-2">Đã gửi yêu cầu rút tiền, chờ quản trị viên nền tảng duyệt.</div>}
      <div className="sm:col-span-2">
        <button type="submit" disabled={request.isPending} className="h-11 rounded-xl bg-brand px-6 text-[14px] font-bold text-white disabled:opacity-60">
          {request.isPending ? 'Đang gửi…' : 'Gửi yêu cầu rút tiền'}
        </button>
      </div>
    </form>
  );
}

function RevenueInner() {
  const { id = '' } = useParams();
  const { data: course } = useCourseDetail(id);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const range = { from: from || undefined, to: to || undefined };
  const revenue = useRevenue(id, range);
  const [page, setPage] = useState(1);
  const payouts = usePayouts(id, page);
  const d = revenue.data;
  const forbidden = revenue.error instanceof ApiError && revenue.error.status === 403;

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <div className="mx-auto max-w-[960px] px-4 py-8 md:px-0">
        <Link to={`/courses/${id}/community`} className="inline-flex items-center gap-1 text-[13px] text-stone-500 hover:text-brand">
          <MaterialIcon name="arrow_back" size={16} /> Về cộng đồng
        </Link>
        <h1 className="mt-1 text-2xl font-extrabold">Doanh thu & rút tiền</h1>
        {course && <p className="text-sm text-stone-500">{course.title}</p>}

        {revenue.isPending && <p className="py-16 text-center text-stone-400">Đang tải…</p>}
        {forbidden && <p className="glass mt-6 rounded-2xl py-12 text-center text-stone-600">Chỉ chủ cộng đồng (hoặc quản trị viên nền tảng) mới xem được doanh thu.</p>}
        {revenue.isError && !forbidden && <p className="py-12 text-center text-red-600">{errText(revenue.error)}</p>}

        {d && (
          <>
            <div className="mt-5 flex flex-wrap items-end gap-3">
              <label className="text-[12.5px] font-semibold">
                Từ ngày
                <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="mt-1 block h-10 rounded-xl border border-[rgba(120,60,20,.12)] bg-white px-3 text-[14px]" />
              </label>
              <label className="text-[12.5px] font-semibold">
                Đến ngày
                <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="mt-1 block h-10 rounded-xl border border-[rgba(120,60,20,.12)] bg-white px-3 text-[14px]" />
              </label>
              {(from || to) && (
                <button type="button" onClick={() => { setFrom(''); setTo(''); }} className="h-10 rounded-xl border border-[rgba(120,60,20,.12)] bg-white px-3.5 text-[13px] font-medium">
                  Xóa lọc
                </button>
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Tổng thu (gross)" value={formatCents(d.grossCents)} />
              <Stat label="Hoàn tiền" value={formatCents(d.refundsCents)} />
              <Stat label="Hoa hồng nền tảng*" value={formatCents(d.platformCommissionCents)} hint={`tạm tính ${d.assumptions.platformCommissionPct}%`} />
              <Stat label="Phí cổng thanh toán*" value={formatCents(d.gatewayFeeCents)} hint={`${d.assumptions.gatewayFeePct}% + ${formatCents(d.assumptions.gatewayFeeFixedCents)}`} />
              <Stat label="Thực nhận (net)" value={formatCents(d.netCents)} accent />
              <Stat label="Số dư khả dụng" value={formatCents(d.availableBalanceCents)} hint="toàn thời gian" accent />
              <Stat label="MRR" value={formatCents(d.mrrCents)} hint={`${d.activePaidMembers} thành viên trả phí · ${d.trialingMembers} dùng thử`} />
              <Stat label="Đang chờ rút" value={formatCents(d.payoutRequestedCents)} />
            </div>
            <p className="mt-3 rounded-xl bg-amber-50 px-4 py-2.5 text-[12.5px] text-amber-800">
              * {d.assumptions.note}. Hoa hồng và phí cổng là giá trị TẠM/mô phỏng, có thể thay đổi khi chốt mô hình doanh thu. Số dư khả dụng không phụ thuộc bộ lọc ngày.
            </p>

            <h2 className="mt-8 mb-3 text-lg font-extrabold">Giao dịch gần nhất</h2>
            <div className="glass overflow-x-auto rounded-3xl">
              <table className="w-full min-w-[560px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-[rgba(120,60,20,.08)] text-[11.5px] tracking-wide text-stone-500">
                    <th className="px-4 py-3 font-semibold">THỜI GIAN</th>
                    <th className="px-2 py-3 font-semibold">LOẠI</th>
                    <th className="px-2 py-3 font-semibold">HÓA ĐƠN</th>
                    <th className="px-2 py-3 font-semibold">TRẠNG THÁI</th>
                    <th className="px-4 py-3 text-right font-semibold">SỐ TIỀN</th>
                  </tr>
                </thead>
                <tbody>
                  {d.recentTransactions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-stone-500">Chưa có giao dịch.</td>
                    </tr>
                  )}
                  {d.recentTransactions.map((t) => (
                    <tr key={t.id} className="border-b border-[rgba(120,60,20,.06)]">
                      <td className="px-4 py-2.5">{t.confirmedAt ? formatDateTime(t.confirmedAt) : '—'}</td>
                      <td className="px-2 py-2.5">{t.kind === 'renewal' ? 'Gia hạn' : 'Thanh toán đầu'}</td>
                      <td className="px-2 py-2.5">{t.invoiceNumber ?? '—'}</td>
                      <td className="px-2 py-2.5">{t.status === 'refunded' ? 'Đã hoàn' : 'Thành công'}</td>
                      <td className="px-4 py-2.5 text-right font-semibold">
                        {formatCents(t.amountCents)}
                        {t.refundedCents > 0 && <div className="text-[11.5px] font-normal text-red-600">hoàn {formatCents(t.refundedCents)}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-8">
              <PayoutForm courseId={id} available={d.availableBalanceCents} />
            </div>

            <h2 className="mt-8 mb-3 text-lg font-extrabold">Lệnh rút tiền</h2>
            <div className="glass overflow-x-auto rounded-3xl">
              <table className="w-full min-w-[560px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-[rgba(120,60,20,.08)] text-[11.5px] tracking-wide text-stone-500">
                    <th className="px-4 py-3 font-semibold">NGÀY</th>
                    <th className="px-2 py-3 font-semibold">SỐ TIỀN</th>
                    <th className="px-2 py-3 font-semibold">TÀI KHOẢN</th>
                    <th className="px-2 py-3 font-semibold">TRẠNG THÁI</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.isPending && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-stone-400">Đang tải…</td>
                    </tr>
                  )}
                  {payouts.data?.data.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-stone-500">Chưa có lệnh rút tiền nào.</td>
                    </tr>
                  )}
                  {payouts.data?.data.map((p) => {
                    const st = PAYOUT_LABEL[p.status];
                    return (
                      <tr key={p.id} className="border-b border-[rgba(120,60,20,.06)]">
                        <td className="px-4 py-2.5">{formatDate(p.createdAt)}</td>
                        <td className="px-2 py-2.5 font-semibold">{formatCents(p.amountCents)}</td>
                        <td className="px-2 py-2.5">
                          {p.method.bankName} · {p.method.accountMasked ?? `****${p.method.accountLast4 ?? ''}`}
                          <div className="text-[11.5px] text-stone-500">{p.method.accountHolder}</div>
                        </td>
                        <td className="px-2 py-2.5">
                          <span className={`inline-flex h-[24px] items-center rounded-lg px-2 text-xs font-medium ${st.cls}`}>{st.text}</span>
                          {p.note && <div className="mt-1 text-[11.5px] text-stone-500">Ghi chú: {p.note}</div>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pager page={page} totalPages={payouts.data?.meta.totalPages ?? 1} onChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}

export function RevenuePage() {
  return (
    <RequireLogin>
      <RevenueInner />
    </RequireLogin>
  );
}

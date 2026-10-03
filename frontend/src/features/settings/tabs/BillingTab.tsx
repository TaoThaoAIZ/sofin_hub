import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { Pager } from '../../../components/ui/Pager';
import { ApiError } from '../../../lib/api';
import { formatCents, formatDate } from '../../../lib/datetime';
import { useToast, useMenu } from '../../admin/components/overlay';
import { InvoiceDialog } from '../../payments/components/InvoiceDialog';
import { useMyPayments, useMySubscriptions } from '../../payments/queries';
import type { PaymentRecord, Subscription } from '../../payments/types';
import { fetchAllPayments, type SavedCard } from '../billing/api';
import { CardModal } from '../billing/CardModal';
import { buildPaymentsCsv, downloadTextFile, PAY_STATUS, paymentDescription } from '../billing/csv';
import { ModalActions, SettingsModal } from '../billing/Modal';
import { useBillingSummary, useCards, useDeleteCard, useSetDefaultCard } from '../billing/queries';
import { RefundModal } from '../billing/RefundModal';
import { SubscriptionModal } from '../billing/SubscriptionModal';
import { CommunityLogo, OUTLINE_BTN, SCard, SHead } from '../ui';

const errText = (e: unknown) => (e instanceof ApiError ? e.message : 'Đã có lỗi xảy ra, vui lòng thử lại');

/** Ô thương hiệu thẻ 74x54 (chữ nghiêng đậm như bản thiết kế). */
const BRAND_TILE: Record<string, { label: string; color: string }> = {
  visa: { label: 'VISA', color: '#1a1f71' },
  mastercard: { label: 'MC', color: '#eb001b' },
  amex: { label: 'AMEX', color: '#2e77bb' },
  discover: { label: 'DISC', color: '#e55c20' },
  jcb: { label: 'JCB', color: '#0b7a3e' },
  unionpay: { label: 'UP', color: '#d10429' },
  diners: { label: 'DC', color: '#0079be' },
};

function BrandTile({ brand }: { brand: string }) {
  const t = BRAND_TILE[brand] ?? { label: 'CARD', color: '#57534e' };
  return (
    <span style={{ color: t.color }} className="grid h-[54px] w-[74px] flex-none place-items-center rounded-xl bg-[#f3f4f8] text-[19px] font-black italic">
      {t.label}
    </span>
  );
}

const expText = (c: SavedCard) => `${String(c.expMonth).padStart(2, '0')}/${String(c.expYear % 100).padStart(2, '0')}`;
const isExpired = (c: SavedCard, now = new Date()) => c.expYear < now.getFullYear() || (c.expYear === now.getFullYear() && c.expMonth < now.getMonth() + 1);

type Modal =
  | { kind: 'card'; mode: 'add' | 'update'; card?: SavedCard }
  | { kind: 'delete'; card: SavedCard }
  | { kind: 'sub'; sub: Subscription }
  | { kind: 'refund'; payment: PaymentRecord }
  | null;

/* ------------------------------------------------------------------ thẻ */
function CardsCard({ onModal }: { onModal: (m: Modal) => void }) {
  const cards = useCards();
  const setDefault = useSetDefaultCard();
  const toast = useToast();
  const { openMenu, menuEl } = useMenu();
  const defaultCard = cards.data?.find((c) => c.isDefault);

  return (
    <SCard>
      <SHead icon="credit_card" size="lg" title="Phương thức thanh toán" sub="Quản lý thẻ thanh toán của bạn." className="mb-[18px]" />
      <div className="flex flex-col gap-2.5">
        {cards.isPending && <p className="py-4 text-center text-stone-400">Đang tải…</p>}
        {cards.isError && <p role="alert" className="py-4 text-center text-[#dc2626]">{errText(cards.error)}</p>}
        {cards.data?.length === 0 && <p className="rounded-2xl border border-dashed border-[#e7e0da] px-4 py-6 text-center text-sm text-stone-500">Bạn chưa lưu thẻ nào. Thêm thẻ để gia hạn gói thành viên tự động.</p>}
        {cards.data?.map((c) => (
          <div key={c.id} className="flex items-center gap-4 rounded-2xl border border-[#f0ebe6] px-4 py-3.5">
            <BrandTile brand={c.brand} />
            <div className="min-w-0 flex-1">
              <div className="text-[17px] font-extrabold tracking-[.04em]">•••• {c.last4}</div>
              <div className={`mt-0.5 text-sm ${isExpired(c) ? 'font-semibold text-[#dc2626]' : 'text-stone-600'}`}>{isExpired(c) ? `Đã hết hạn ${expText(c)}` : `Hết hạn ${expText(c)}`}</div>
            </div>
            {c.isDefault && <span className="rounded-full bg-[#dcfce7] px-3 py-[5px] text-[13px] font-semibold text-[#15803d]">Mặc định</span>}
            <button
              type="button"
              aria-label={`Tùy chọn thẻ ${c.last4}`}
              onClick={(e) =>
                openMenu(
                  e,
                  [
                    ...(c.isDefault
                      ? []
                      : [
                          {
                            label: 'Đặt làm mặc định',
                            onClick: () => setDefault.mutate(c.id, { onSuccess: () => toast.success(`Đã đặt thẻ •••• ${c.last4} làm mặc định`), onError: (er) => toast.error(errText(er)) }),
                          },
                        ]),
                    { label: 'Cập nhật thẻ', onClick: () => onModal({ kind: 'card', mode: 'update', card: c }) },
                    { label: 'Xóa thẻ', danger: true, onClick: () => onModal({ kind: 'delete', card: c }) },
                  ],
                  undefined,
                  210,
                )
              }
              className="grid size-[34px] place-items-center rounded-[10px] border-0 bg-transparent hover:bg-[#f5f2ef]"
            >
              <MaterialIcon name="more_horiz" size={22} />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-5">
        <button type="button" onClick={() => onModal({ kind: 'card', mode: 'add' })} className="inline-flex h-[46px] items-center gap-2 rounded-xl border-[1.5px] border-[#fdba74] bg-white px-[22px] text-[14.5px] font-bold">
          <MaterialIcon name="add" size={20} />
          Thêm thẻ
        </button>
        <button
          type="button"
          disabled={!defaultCard}
          onClick={() => defaultCard && onModal({ kind: 'card', mode: 'update', card: defaultCard })}
          className="inline-flex items-center gap-2 border-0 bg-transparent p-0 text-[14.5px] font-bold text-[#15803d] disabled:opacity-40"
        >
          <MaterialIcon name="sync" size={20} />
          Cập nhật thẻ
        </button>
      </div>
      {menuEl}
    </SCard>
  );
}

/* ------------------------------------------------------------------ lần trừ tiếp theo */
function NextChargeCard() {
  const summary = useBillingSummary();
  const s = summary.data;
  return (
    <section
      className="relative min-w-0 overflow-hidden rounded-[20px] px-7 py-[26px] text-white"
      style={{ background: 'radial-gradient(120% 140% at 100% 0%,#3a4a3a 0%,#1f2a22 45%,#141a16 100%)' }}
    >
      <span className="absolute top-[26px] right-7">
        <MaterialIcon name="account_balance_wallet" size={36} filled color="#fdba74" />
      </span>
      <div className="text-[15px] text-[#e7e5e4]">Lần trừ tiền tiếp theo</div>
      <div className="mt-1.5 text-[38px] font-extrabold tracking-[-.02em]">{summary.isPending ? '…' : formatCents(s?.next?.amountCents ?? 0)}</div>
      <div className="mt-1.5 text-[14.5px] text-[#d6d3d1]">
        {summary.isError ? errText(summary.error) : s?.next ? `Ngày ${formatDate(s.next.date)} · ${s.next.communityTitle}${s.next.trialing ? ' (hết dùng thử)' : ''}` : 'Không có gói nào đang hoạt động'}
      </div>
      <div className="mt-[22px] flex items-center justify-between border-t border-white/[.18] pt-[18px] text-[15px]">
        <span className="text-[#e7e5e4]">Tổng mỗi tháng</span>
        <b className="text-xl">{formatCents(s?.monthlyTotalCents ?? 0)}</b>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ gói thành viên */
function subStatus(s: Subscription): { text: string; tone: 'green' | 'amber' | 'gray' } {
  if (s.status === 'active' || s.status === 'trialing') {
    if (s.cancelAtPeriodEnd) return { text: 'Đã hủy', tone: 'gray' };
    return s.status === 'trialing' ? { text: 'Đang dùng thử', tone: 'amber' } : { text: 'Đang hoạt động', tone: 'green' };
  }
  if (s.status === 'canceled') return { text: 'Đã hủy', tone: 'gray' };
  if (s.status === 'expired') return { text: 'Hết hạn', tone: 'gray' };
  return { text: s.status === 'paused' ? 'Tạm dừng' : 'Quá hạn', tone: 'amber' };
}

function subLine(s: Subscription): string {
  const price = formatCents(s.priceCents);
  const per = s.interval === 'annual' ? 'năm' : 'tháng';
  const live = s.status === 'active' || s.status === 'trialing';
  if (live && s.cancelAtPeriodEnd) return `${price} / ${per} · Hết hạn ${formatDate(s.accessUntil ?? s.currentPeriodEnd)}`;
  if (s.status === 'trialing') return `Dùng thử · trừ ${price} ngày ${formatDate(s.currentPeriodEnd)}`;
  if (s.status === 'active') return `${price} / ${per} · Gia hạn ${formatDate(s.currentPeriodEnd)}`;
  return `${price} / ${per} · Kết thúc ${formatDate(s.canceledAt ?? s.currentPeriodEnd)}`;
}

const isLive = (s: Subscription) => s.status === 'active' || s.status === 'trialing';

function SubscriptionsCard({ onModal }: { onModal: (m: Modal) => void }) {
  const subs = useMySubscriptions();
  const sorted = [...(subs.data ?? [])].sort((a, b) => Number(isLive(b)) - Number(isLive(a)));
  return (
    <SCard>
      <SHead icon="workspace_premium" size="lg" title="Gói thành viên của tôi" sub="Danh sách các cộng đồng bạn đang tham gia." className="mb-[18px]" />
      {subs.isPending && <p className="py-4 text-center text-stone-400">Đang tải…</p>}
      {subs.isError && <p role="alert" className="py-4 text-center text-[#dc2626]">{errText(subs.error)}</p>}
      {subs.data?.length === 0 && <p className="rounded-2xl border border-dashed border-[#e7e0da] px-4 py-6 text-center text-sm text-stone-500">Bạn chưa có gói thành viên trả phí hoặc dùng thử nào.</p>}
      {sorted.length > 0 && (
        <div className="rounded-2xl border border-[#f0ebe6] px-4">
          {sorted.map((s) => {
            const st = subStatus(s);
            const title = s.courseTitle ?? 'Cộng đồng';
            return (
              <div key={s.id} className="flex flex-wrap items-center gap-4 border-b border-[#f3eee9] py-4 last:border-b-0">
                <CommunityLogo name={title} seed={s.courseId} />
                <div className="min-w-[200px] flex-1">
                  <div className="text-base font-bold">{title}</div>
                  <div className="mt-[3px] text-sm text-stone-500">{subLine(s)}</div>
                </div>
                <span
                  className={`inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-sm font-semibold ${st.tone === 'green' ? 'bg-[#dcfce7] text-[#15803d]' : st.tone === 'amber' ? 'bg-[#fef3c7] text-[#b45309]' : 'bg-[#f1efed] text-stone-600'}`}
                >
                  <span className={`size-[9px] rounded-full ${st.tone === 'green' ? 'bg-[#16a34a]' : st.tone === 'amber' ? 'bg-[#f59e0b]' : 'bg-[#a8a29e]'}`} />
                  {st.text}
                </span>
                <button type="button" onClick={() => onModal({ kind: 'sub', sub: s })} className={`${OUTLINE_BTN} px-6`}>
                  Quản lý
                </button>
                <Link to={isLive(s) ? `/communities/${s.courseId}/community` : `/communities/${s.courseId}`} aria-label={`Mở cộng đồng ${title}`} className="grid place-items-center text-stone-600">
                  <MaterialIcon name="chevron_right" size={22} />
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </SCard>
  );
}

/* ------------------------------------------------------------------ lịch sử */
const COLS = 'grid-cols-[120px_minmax(240px,2fr)_130px_150px_100px]';

function HistoryCard({ onInvoice }: { onInvoice: (id: string) => void }) {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const payments = useMyPayments(page);
  const [exporting, setExporting] = useState(false);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const rows = await fetchAllPayments();
      if (rows.length === 0) return toast.error('Chưa có giao dịch nào để tải');
      downloadTextFile('lich-su-thanh-toan.csv', buildPaymentsCsv(rows));
      toast.success('Đã tải lịch sử thanh toán');
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setExporting(false);
    }
  };

  return (
    <SCard>
      <SHead
        icon="history"
        size="lg"
        title="Lịch sử thanh toán"
        sub="Xem lại các giao dịch thanh toán của bạn."
        className="mb-[18px]"
        action={
          <button type="button" onClick={exportCsv} disabled={exporting} className={`${OUTLINE_BTN} px-[18px]`}>
            <MaterialIcon name="download" size={20} />
            {exporting ? 'Đang tạo…' : 'Tải tất cả (CSV)'}
          </button>
        }
      />
      <div className="overflow-x-auto">
        <div className="min-w-[820px]">
          <div className={`grid ${COLS} gap-3 rounded-xl bg-[#f7f4f1] px-[18px] py-3.5 text-sm text-stone-600`}>
            <span>Ngày</span>
            <span>Mô tả</span>
            <span>Số tiền</span>
            <span>Trạng thái</span>
            <span>Hóa đơn</span>
          </div>
          {payments.isPending && <p className="py-8 text-center text-stone-400">Đang tải…</p>}
          {payments.isError && <p role="alert" className="py-8 text-center text-[#dc2626]">{errText(payments.error)}</p>}
          {payments.data?.data.length === 0 && <p className="py-8 text-center text-stone-500">Chưa có giao dịch nào.</p>}
          {payments.data?.data.map((p) => {
            const st = PAY_STATUS[p.status] ?? { text: p.status, color: '#57534e', dot: '#a8a29e' };
            const cents = p.amountCents ?? Math.round(p.amountUsd * 100);
            return (
              <div key={p.id} className={`grid ${COLS} items-center gap-3 border-b border-[#f3eee9] px-[18px] py-4 text-[15px]`}>
                <span>{formatDate(p.confirmedAt ?? p.createdAt)}</span>
                <span className="truncate" title={paymentDescription(p)}>
                  {paymentDescription(p)}
                </span>
                <span className="font-semibold">
                  {formatCents(cents)}
                  {p.refundedCents ? <span className="block text-xs font-medium text-[#dc2626]">Đã hoàn {formatCents(p.refundedCents)}</span> : null}
                </span>
                <span style={{ color: st.color }} className="flex items-center gap-2">
                  <span style={{ background: st.dot }} className="size-2 rounded-full" />
                  <span>
                    {st.text}
                    {p.refundStatus && p.status !== 'refunded' && <span className="block text-xs text-stone-500">{p.refundStatus === 'rejected' ? 'Hoàn tiền: bị từ chối' : 'Hoàn tiền: chờ duyệt'}</span>}
                  </span>
                </span>
                {p.invoiceNumber ? (
                  <button type="button" onClick={() => onInvoice(p.id)} className="flex items-center gap-1.5 border-0 bg-transparent p-0 font-semibold text-[#15803d] underline">
                    Hóa đơn
                    <MaterialIcon name="open_in_new" size={18} />
                  </button>
                ) : (
                  <span className="text-stone-400">—</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <Pager page={page} totalPages={payments.data?.meta.totalPages ?? 1} onChange={setPage} />
    </SCard>
  );
}

/* ------------------------------------------------------------------ xác nhận xóa thẻ */
function DeleteCardModal({ card, onClose }: { card: SavedCard; onClose: () => void }) {
  const del = useDeleteCard();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  return (
    <SettingsModal
      title={`Xóa thẻ •••• ${card.last4}?`}
      body="Thẻ sẽ bị gỡ khỏi tài khoản. Gói đang dùng thẻ này (nếu có) sẽ chuyển sang thẻ mặc định còn lại; nếu đây là thẻ duy nhất của một gói đang chạy, bạn cần thêm thẻ khác trước."
      onClose={onClose}
      busy={del.isPending}
    >
      {error && (
        <div role="alert" className="text-[13px] font-semibold text-[#dc2626]">
          {error}
        </div>
      )}
      <ModalActions
        okLabel="Xóa thẻ"
        danger
        pending={del.isPending}
        onCancel={onClose}
        onOk={() =>
          del.mutate(card.id, {
            onSuccess: () => {
              toast.success(`Đã xóa thẻ •••• ${card.last4}`);
              onClose();
            },
            onError: (e) => setError(errText(e)),
          })
        }
      />
    </SettingsModal>
  );
}

export function BillingTab() {
  const [modal, setModal] = useState<Modal>(null);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const close = () => setModal(null);

  return (
    <main className="flex min-w-0 flex-col gap-[18px]">
      <div className="grid items-stretch gap-[18px] min-[1180px]:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <CardsCard onModal={setModal} />
        <NextChargeCard />
      </div>
      <SubscriptionsCard onModal={setModal} />
      <HistoryCard onInvoice={setInvoiceId} />

      {modal?.kind === 'card' && <CardModal key={`${modal.mode}-${modal.card?.id ?? 'new'}`} mode={modal.mode} card={modal.card} onClose={close} />}
      {modal?.kind === 'delete' && <DeleteCardModal card={modal.card} onClose={close} />}
      {modal?.kind === 'sub' && <SubscriptionModal sub={modal.sub} onClose={close} onRefund={(payment) => setModal({ kind: 'refund', payment })} />}
      {modal?.kind === 'refund' && <RefundModal payment={modal.payment} onClose={close} />}
      {invoiceId && <InvoiceDialog paymentId={invoiceId} onClose={() => setInvoiceId(null)} />}
    </main>
  );
}

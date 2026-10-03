import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { ApiError } from '../../../lib/api';
import { formatCents, formatDate } from '../../../lib/datetime';
import { formatMoney } from '../../../lib/format';
import { useMenu, useToast } from '../../admin/components/overlay';
import { useStartConversation } from '../../messages/useStartConversation';
import { ModalActions, SettingsModal } from '../billing/Modal';
import { useCommissions, useReferral, useReferralUsers, useRemind } from '../referral/queries';
import type { ReferralKind, ReferralRow, ReferralRowStatus } from '../referral/types';
import { SCard, SHead } from '../ui';

const errText = (e: unknown) => (e instanceof ApiError ? e.message : 'Đã có lỗi xảy ra, vui lòng thử lại');

/** Tiền hoa hồng: member = USD cent, creator = VND (đơn vị đồng, không có phần thập phân). */
const money = (amount: number, currency: string) => (currency === 'VND' ? formatMoney(amount, 'VND') : formatCents(amount));
/** 3000 bps -> "30%", 250 -> "2,5%". */
const pct = (bps: number) => `${(bps / 100).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%`;

const KINDS: { id: ReferralKind; label: string }[] = [
  { id: 'creator', label: 'Giới thiệu người tạo cộng đồng' },
  { id: 'member', label: 'Giới thiệu thành viên' },
];

const STATUS: Record<ReferralRowStatus, { label: string; bg: string; fg: string }> = {
  paid: { label: 'Đang trả phí', bg: '#dcfce7', fg: '#15803d' },
  trial: { label: 'Đang dùng thử', bg: '#fef3c7', fg: '#b45309' },
  cancel: { label: 'Đã hủy', bg: '#f1efed', fg: '#57534e' },
  none: { label: '', bg: '#f1efed', fg: '#78716c' },
};
const NONE_LABEL: Record<ReferralKind, string> = { creator: 'Chưa trả phí', member: 'Chưa tham gia' };
const AVATARS: readonly [string, string][] = [
  ['#fee2e2', '#b91c1c'],
  ['#ede9fe', '#6d28d9'],
  ['#dcfce7', '#15803d'],
  ['#f1efed', '#44403c'],
];

/** "Trần Bảo Ngọc" -> "TB" (chữ cái đầu của hai từ đầu). */
const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join('')
    .toUpperCase();

const COLS = 'grid-cols-[minmax(200px,1.3fr)_minmax(200px,1.4fr)_140px_160px_140px_40px]';

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Trình duyệt chặn Clipboard API (http / iframe): dùng cách cũ.
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

function CommissionModal({ row, kind, currency, onClose }: { row: ReferralRow; kind: ReferralKind; currency: string; onClose: () => void }) {
  const q = useCommissions(row.userId, kind);
  return (
    <SettingsModal title="Chi tiết hoa hồng" body={`${row.name} · đã nhận ${money(row.earnedCents, currency)}`} onClose={onClose}>
      {q.isPending && <p className="py-3 text-center text-stone-400">Đang tải…</p>}
      {q.isError && <p role="alert" className="py-3 text-center text-[#dc2626]">{errText(q.error)}</p>}
      {q.data && q.data.data.length === 0 && <p className="rounded-xl bg-[#faf7f4] px-4 py-5 text-center text-sm text-stone-500">Chưa có khoản hoa hồng nào từ người này.</p>}
      {q.data && q.data.data.length > 0 && (
        <ul className="m-0 flex max-h-[280px] list-none flex-col gap-2 overflow-y-auto p-0">
          {q.data.data.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#f0ebe6] px-3.5 py-2.5 text-sm">
              <span className="min-w-0">
                <b className={`block font-bold ${c.status === 'void' ? 'text-stone-400 line-through' : ''}`}>{money(c.amountCents, q.data.currency)}</b>
                <span className="text-xs text-stone-500">
                  {formatDate(c.createdAt)} · {pct(c.rateBps)} của {money(c.baseCents, q.data.currency)}
                </span>
              </span>
              <span className="text-xs font-semibold text-stone-500">{c.status === 'paid' ? 'Đã chi trả' : c.status === 'void' ? 'Đã hủy' : 'Chờ chi trả'}</span>
            </li>
          ))}
        </ul>
      )}
      <ModalActions cancelLabel="Đóng" okLabel="Xong" onCancel={onClose} onOk={onClose} />
    </SettingsModal>
  );
}

export function ReferralTab() {
  const toast = useToast();
  const [kind, setKind] = useState<ReferralKind>('creator');
  const [all, setAll] = useState(false);
  const [detail, setDetail] = useState<ReferralRow | null>(null);
  const overview = useReferral(kind);
  const users = useReferralUsers(kind, all);
  const remind = useRemind();
  const { openMenu, menuEl } = useMenu();
  const dm = useStartConversation();

  useEffect(() => {
    if (dm.error) {
      toast.error(dm.error);
      dm.clearError();
    }
  }, [dm, toast]);

  const o = overview.data;
  const currency = o?.currency ?? (kind === 'creator' ? 'VND' : 'USD');
  const rows = users.data?.data ?? [];
  const total = users.data?.meta.total ?? 0;
  const rate = pct(o?.rates.rateBps ?? (kind === 'creator' ? 3000 : 1000));
  const link = o?.link ?? '';

  const copy = async () => {
    if (!link) return;
    if (await copyText(link)) toast.success('Đã sao chép link giới thiệu');
    else toast.error('Không sao chép được, hãy chọn và sao chép link thủ công');
  };

  const kpis = [
    { icon: 'group_add', label: 'Người đã đăng ký', v: String(o?.kpis.registered.value ?? 0), delta: o?.kpis.registered.delta != null ? `+${o.kpis.registered.delta}` : '', down: false, note: 'so với tháng trước' },
    { icon: 'workspace_premium', label: 'Đang trả phí', v: String(o?.kpis.paying.value ?? 0), delta: '', down: false, note: 'so với tháng trước' },
    {
      icon: 'paid',
      label: 'Hoa hồng tháng này',
      v: money(o?.kpis.commissionThisMonth.cents ?? 0, currency),
      delta: o?.kpis.commissionThisMonth.deltaPct != null ? `${o.kpis.commissionThisMonth.deltaPct > 0 ? '+' : ''}${o.kpis.commissionThisMonth.deltaPct}%` : '',
      down: (o?.kpis.commissionThisMonth.deltaPct ?? 0) < 0,
      note: 'so với tháng trước',
    },
    { icon: 'account_balance_wallet', label: 'Chờ chi trả', v: money(o?.kpis.pendingPayout.cents ?? 0, currency), delta: '', down: false, note: o ? `Chi trả ngày ${formatDate(o.kpis.pendingPayout.payoutOn)}` : '' },
  ];

  const steps = [
    { n: '1', t: 'Chia sẻ link', s: `Ai bấm link được ghi nhận cho bạn trong ${o?.rates.attributionDays ?? 60} ngày.` },
    { n: '2', t: kind === 'creator' ? 'Họ mở cộng đồng' : 'Họ tham gia cộng đồng', s: 'Bạn thấy họ ở bảng dưới ngay khi họ bắt đầu dùng thử.' },
    { n: '3', t: 'Bạn nhận hoa hồng', s: `Mỗi tháng họ thanh toán, bạn nhận ${rate}.` },
  ];

  const rowMenu = (e: React.MouseEvent<HTMLElement>, r: ReferralRow) =>
    openMenu(
      e,
      [
        { icon: 'chat', label: 'Gửi tin nhắn', onClick: () => void dm.startConversation(r.userId) },
        { icon: 'receipt_long', label: 'Chi tiết hoa hồng', onClick: () => setDetail(r) },
        ...(r.status === 'trial'
          ? [
              {
                icon: 'notifications',
                label: 'Nhắc nâng cấp gói',
                onClick: () => remind.mutate({ userId: r.userId, kind }, { onSuccess: () => toast.success(`Đã gửi lời nhắc cho ${r.name}`), onError: (er) => toast.error(errText(er)) }),
              },
            ]
          : []),
      ],
      undefined,
      230,
    );

  return (
    <main className="flex min-w-0 flex-col gap-[18px]">
      <div className="flex flex-wrap items-center gap-3.5">
        <div role="tablist" className="flex rounded-[14px] bg-[#f5f2ef] p-1">
          {KINDS.map((k) => {
            const on = k.id === kind;
            return (
              <button
                key={k.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => {
                  setKind(k.id);
                  setAll(false);
                }}
                className={`flex h-11 items-center gap-2 rounded-[11px] border-[1.5px] px-[18px] text-[15px] font-semibold whitespace-nowrap ${on ? 'border-[#fdba74] bg-white text-brand' : 'border-transparent bg-transparent text-stone-600'}`}
              >
                {on && <MaterialIcon name="settings" size={19} filled color="#f26a1b" />}
                {k.label}
              </button>
            );
          })}
        </div>
        <div className="flex-1" />
        <Link to="/settings/thanh-toan" className="flex items-center gap-2 text-[15px] font-semibold text-brand underline">
          <MaterialIcon name="settings" size={21} />
          Cài đặt nhận tiền
          <MaterialIcon name="arrow_forward" size={19} />
        </Link>
      </div>

      <section className="relative flex flex-wrap items-end gap-6 overflow-hidden rounded-[20px] border border-[#fde3cf] px-[30px] py-7" style={{ background: 'linear-gradient(110deg,#fff6ef 0%,#ffe3cd 100%)' }}>
        <span className="pointer-events-none absolute top-4 right-6 opacity-90">
          <MaterialIcon name="redeem" size={60} filled color="#f26a1b" />
        </span>
        <div className="min-w-0 flex-[1_1_420px] pr-[72px]">
          <h1 className="m-0 text-[clamp(26px,2.6vw,34px)] leading-[1.2] font-extrabold tracking-[-.02em]">
            Nhận <span className="text-brand">{rate}</span> {kind === 'creator' ? 'mỗi tháng từ người bạn giới thiệu mở cộng đồng' : 'mỗi tháng từ thành viên bạn mời vào cộng đồng trả phí'}
          </h1>
          <div className="mt-3 text-base text-stone-600">
            {kind === 'creator' ? 'Hoa hồng định kỳ, trả mỗi tháng người đó còn dùng gói trả phí.' : 'Áp dụng cho cộng đồng có bật chương trình giới thiệu thành viên.'}
          </div>
        </div>
        <div className="relative min-w-[280px] flex-[0_1_460px]">
          <div className="mb-2 text-sm text-stone-700">Link giới thiệu của bạn</div>
          <div className="flex gap-3">
            <div className="flex h-[50px] min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-[#f0e2d7] bg-white px-4">
              <span className="min-w-0 flex-1 truncate text-[14.5px]">{link ? link.replace(/^https?:\/\//, '') : overview.isError ? 'Không tải được link' : '…'}</span>
              <button type="button" aria-label="Sao chép link" onClick={copy} disabled={!link} className="border-0 bg-transparent p-0 text-stone-600">
                <MaterialIcon name="content_copy" size={20} />
              </button>
            </div>
            <button
              type="button"
              onClick={copy}
              disabled={!link}
              className="h-[50px] rounded-xl border-0 bg-gradient-to-b from-[#ff8f45] to-[#f26a1b] px-7 text-[15px] font-bold text-white shadow-[0_8px_20px_rgba(242,106,27,.3)] disabled:opacity-60"
            >
              Sao chép
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
        {kpis.map((k) => (
          <div key={k.label} className="flex min-w-0 gap-3.5 rounded-[20px] border border-[rgba(120,60,20,.07)] bg-white px-5 py-[18px]">
            <span className="grid size-11 flex-none place-items-center rounded-xl bg-[#fff1e6]">
              <MaterialIcon name={k.icon} size={23} filled color="#f26a1b" />
            </span>
            <div className="min-w-0">
              <div className="text-sm text-stone-700">{k.label}</div>
              <div className="mt-1.5 flex items-baseline gap-2.5">
                <span className="text-[28px] font-extrabold tracking-[-.02em]">{k.v}</span>
                {k.delta && (
                  <span className={`flex items-center gap-0.5 text-[13px] font-bold ${k.down ? 'text-[#dc2626]' : 'text-[#15803d]'}`}>
                    <MaterialIcon name={k.down ? 'arrow_downward' : 'arrow_upward'} size={16} />
                    {k.delta}
                  </span>
                )}
              </div>
              <div className="mt-1 text-[12.5px] text-stone-500">{k.note}</div>
            </div>
          </div>
        ))}
      </div>

      <section className="grid min-w-0 items-center gap-4 rounded-[20px] border border-[rgba(120,60,20,.07)] bg-white px-6 py-5 min-[1100px]:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)]">
        {steps.map((st, i) => (
          <StepItem key={st.n} step={st} arrow={i < steps.length - 1} />
        ))}
      </section>

      <SCard>
        <SHead
          icon="group_add"
          size="lg"
          title="Người bạn đã giới thiệu"
          sub="Danh sách những người đã đăng ký từ link giới thiệu của bạn."
          className="mb-4"
          action={
            total > 4 ? (
              <button type="button" onClick={() => setAll((v) => !v)} className="flex items-center gap-1.5 border-0 bg-transparent p-0 text-[15px] font-bold text-[#15803d] underline">
                {all ? 'Thu gọn' : `Xem tất cả ${total}`}
                <MaterialIcon name="arrow_forward" size={19} color="#f26a1b" />
              </button>
            ) : undefined
          }
        />
        <div className="overflow-x-auto">
          <div className="min-w-[820px]">
            <div className={`grid ${COLS} gap-3 rounded-xl bg-[#f7f4f1] px-4 py-3.5 text-[13.5px] text-stone-600`}>
              <span>Người dùng</span>
              <span>Cộng đồng</span>
              <span>Ngày đăng ký</span>
              <span>Trạng thái</span>
              <span>Hoa hồng đã nhận</span>
              <span />
            </div>
            {users.isPending && <p className="py-8 text-center text-stone-400">Đang tải…</p>}
            {users.isError && <p role="alert" className="py-8 text-center text-[#dc2626]">{errText(users.error)}</p>}
            {users.data && rows.length === 0 && (
              <div className="py-10 text-center">
                <MaterialIcon name="group_add" size={34} color="#fdba74" />
                <div className="mt-2 text-[15px] font-bold">Chưa có ai đăng ký từ link của bạn</div>
                <div className="mt-1 text-sm text-stone-500">Sao chép link giới thiệu ở trên và chia sẻ cho bạn bè để bắt đầu nhận hoa hồng.</div>
              </div>
            )}
            {rows.map((r, i) => {
              const st = STATUS[r.status];
              const [bg, fg] = AVATARS[i % AVATARS.length]!;
              return (
                <div key={r.userId} className={`grid ${COLS} items-center gap-3 border-b border-[#f3eee9] px-4 py-3.5 text-[15px]`}>
                  <span className="flex min-w-0 items-center gap-3.5">
                    {r.avatarUrl ? (
                      <img src={r.avatarUrl} alt="" className="size-10 flex-none rounded-full object-cover" />
                    ) : (
                      <span style={{ background: bg, color: fg }} className="grid size-10 flex-none place-items-center rounded-full text-[13px] font-bold">
                        {initials(r.name)}
                      </span>
                    )}
                    <span className="truncate font-semibold">{r.name}</span>
                  </span>
                  <span className="truncate text-stone-700" title={r.communityName ?? undefined}>
                    {r.communityName ?? '—'}
                  </span>
                  <span className="text-stone-700">{formatDate(r.signedUpAt)}</span>
                  <span>
                    <span style={{ background: st.bg, color: st.fg }} className="inline-flex h-[30px] items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold whitespace-nowrap">
                      <span style={{ background: st.fg }} className="size-[7px] rounded-full" />
                      {r.status === 'none' ? NONE_LABEL[kind] : st.label}
                    </span>
                  </span>
                  <span className="text-stone-700">{r.earnedCents > 0 ? money(r.earnedCents, currency) : '—'}</span>
                  <button type="button" aria-label={`Tùy chọn cho ${r.name}`} onClick={(e) => rowMenu(e, r)} className="border-0 bg-transparent p-0 text-stone-800">
                    <MaterialIcon name="more_horiz" size={22} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </SCard>

      {menuEl}
      {detail && <CommissionModal row={detail} kind={kind} currency={currency} onClose={() => setDetail(null)} />}
    </main>
  );
}

function StepItem({ step, arrow }: { step: { n: string; t: string; s: string }; arrow: boolean }) {
  return (
    <>
      <div className="flex items-start gap-3.5">
        <span className="grid size-11 flex-none place-items-center rounded-full bg-[#fff1e6] text-xl font-extrabold text-brand">{step.n}</span>
        <div>
          <div className="text-[16.5px] font-extrabold">{step.t}</div>
          <div className="mt-1 text-[13.5px] leading-normal text-stone-500">{step.s}</div>
        </div>
      </div>
      {arrow && (
        <span className="hidden min-[1100px]:block">
          <MaterialIcon name="arrow_forward" size={22} color="#f26a1b" />
        </span>
      )}
    </>
  );
}

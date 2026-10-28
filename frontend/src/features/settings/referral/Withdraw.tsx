import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { ApiError } from '../../../lib/api';
import { formatDate } from '../../../lib/datetime';
import { formatMoney } from '../../../lib/format';
import { useToast } from '../../admin/components/overlay';
import { ModalActions, SettingsModal } from '../billing/Modal';
import { BARE_INPUT, IconInput, OUTLINE_BTN, PRIMARY_BTN } from '../ui';
import { useBanks, useRequestWithdraw, useSaveAccount, useWithdraw, useWithdrawalStatus } from './queries';
import type { DirectPayout, Withdrawal } from './types';

const vnd = (n: number) => formatMoney(n, 'VND');
const errMsg = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);
const digits = (s: string) => s.replace(/\D/g, '');

/** Thẻ "Rút tiền hoa hồng": số dư, tài khoản nhận (thêm/đổi), nút "Rút tiền ngay" và lịch sử. */
export function WithdrawCard() {
  const { t } = useTranslation('settings');
  const q = useWithdraw();
  const [modal, setModal] = useState<'account' | 'withdraw' | 'history' | null>(null);
  const w = q.data;
  const canWithdraw = !!w && w.withdrawableCents >= w.minCents;

  return (
    <aside className="flex min-w-0 flex-col self-start rounded-[20px] border-[1.5px] border-[#fdba74] bg-white p-5 dark:border-[rgba(255,87,10,.45)]">
      <div className="flex items-start gap-3">
        <span className="grid size-10 flex-none place-items-center rounded-xl bg-[#fff1e6]">
          <MaterialIcon name="account_balance_wallet" size={22} filled color="#ff570a" />
        </span>
        <h2 className="m-0 flex-1 text-[17px] font-extrabold whitespace-nowrap">{t('referral.withdraw.title')}</h2>
        <button type="button" onClick={() => setModal('history')} className="flex items-center gap-1 border-0 bg-transparent p-0 text-[11.5px] font-semibold whitespace-nowrap text-brand underline">
          {t('referral.withdraw.history')}
          <MaterialIcon name="arrow_forward" size={15} />
        </button>
      </div>

      <div className="mt-4 flex items-center gap-1.5 text-sm text-stone-700">
        {t('referral.withdraw.balance')}
        <span title={t('referral.withdraw.balanceHint')} className="cursor-help">
          <MaterialIcon name="info" size={16} color="#a8a29e" />
        </span>
      </div>
      <div className="mt-1 text-[32px] leading-tight font-extrabold tracking-[-.02em]">{w ? vnd(w.withdrawableCents) : '…'}</div>
      {w && w.pendingCents > 0 && <div className="mt-1 text-[12.5px] text-stone-500">{t('referral.withdraw.pendingNote', { amount: vnd(w.pendingCents) })}</div>}

      <div className="mt-4 text-sm font-semibold">{t('referral.withdraw.method')}</div>
      <div className="mt-2 flex h-12 items-center gap-2.5 rounded-xl border-[1.5px] border-[#e7e0da] px-3.5 text-[14.5px] font-medium">
        <MaterialIcon name="account_balance" size={22} color="#ff570a" />
        {t('referral.withdraw.methodBank')}
      </div>

      <div className="mt-3 rounded-xl bg-[#fff7f1] px-4 py-3 text-[13.5px]">
        {w?.account ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <span className="text-stone-600">{t('referral.withdraw.bank')}</span>
              <span className="flex min-w-0 items-center gap-3">
                <b className="truncate font-bold">{w.account.bankName}</b>
                <button type="button" onClick={() => setModal('account')} className="flex-none border-0 bg-transparent p-0 text-[13px] font-semibold text-brand underline">
                  {t('referral.withdraw.change')}
                </button>
              </span>
            </div>
            <Row k={t('referral.withdraw.accountNo')} v={w.account.accountMasked} />
            <Row k={t('referral.withdraw.holder')} v={w.account.accountHolder} />
          </>
        ) : (
          <button type="button" onClick={() => setModal('account')} className="flex w-full items-center justify-center gap-2 border-0 bg-transparent py-1 text-sm font-semibold text-brand">
            <MaterialIcon name="add_circle" size={20} color="#ff570a" />
            {t('referral.withdraw.addAccount')}
          </button>
        )}
      </div>

      <button
        type="button"
        disabled={!w || (!!w.account && !canWithdraw)}
        onClick={() => setModal(w?.account ? 'withdraw' : 'account')}
        className={`${PRIMARY_BTN} mt-4 h-[52px] text-[16px]`}
      >
        {t('referral.withdraw.now')}
      </button>
      <div className="mt-2.5 flex items-center justify-center gap-1.5 text-[12.5px] text-stone-500">
        <MaterialIcon name="schedule" size={15} />
        {t('referral.withdraw.processing')}
      </div>
      {w && <div className="mt-1 text-center text-[12px] text-stone-400">{t('referral.withdraw.minNote', { min: vnd(w.minCents) })}</div>}

      {modal === 'account' && <AccountModal onClose={() => setModal(null)} onSaved={() => setModal(null)} />}
      {modal === 'withdraw' && w && <WithdrawModal onClose={() => setModal(null)} />}
      {modal === 'history' && <HistoryModal items={w?.withdrawals ?? []} direct={w?.directPayouts ?? []} onClose={() => setModal(null)} />}
    </aside>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="mt-2 flex justify-between gap-3">
      <span className="text-stone-600">{k}</span>
      <b className="min-w-0 truncate text-right font-bold">{v}</b>
    </div>
  );
}

export function AccountModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation('settings');
  const toast = useToast();
  const banks = useBanks();
  const overview = useWithdraw();
  const save = useSaveAccount();
  const [bankBin, setBankBin] = useState(overview.data?.account?.bankBin ?? '');
  const [number, setNumber] = useState('');
  const [holder, setHolder] = useState(overview.data?.account?.accountHolder ?? '');
  const [error, setError] = useState<string | null>(null);
  const ok = bankBin && digits(number).length >= 6 && holder.trim().length >= 2;

  const submit = () =>
    save.mutate(
      { bankBin, accountNumber: digits(number), accountHolder: holder },
      {
        onSuccess: () => {
          toast.success(t('referral.withdraw.accountSaved'));
          onSaved();
        },
        onError: (e) => setError(errMsg(e, t('common.genericError'))),
      },
    );

  return (
    <SettingsModal title={t('referral.withdraw.accountTitle')} body={t('referral.withdraw.accountBody')} onClose={onClose} busy={save.isPending}>
      <div className="flex flex-col gap-3.5">
        <Field label={t('referral.withdraw.fieldBank')}>
          <IconInput icon="account_balance">
            <select value={bankBin} onChange={(e) => setBankBin(e.target.value)} className={`${BARE_INPUT} cursor-pointer`}>
              <option value="">{t('referral.withdraw.selectBank')}</option>
              {(banks.data ?? []).map((b) => (
                <option key={b.bin} value={b.bin}>
                  {b.short} — {b.name}
                </option>
              ))}
            </select>
          </IconInput>
        </Field>
        <Field label={t('referral.withdraw.fieldNumber')}>
          <IconInput icon="credit_card">
            <input value={number} onChange={(e) => setNumber(e.target.value)} inputMode="numeric" maxLength={24} placeholder={overview.data?.account ? overview.data.account.accountMasked : '0123456789'} className={BARE_INPUT} />
          </IconInput>
        </Field>
        <Field label={t('referral.withdraw.fieldHolder')} hint={t('referral.withdraw.holderHint')}>
          <IconInput icon="person">
            <input value={holder} onChange={(e) => setHolder(e.target.value)} maxLength={80} placeholder="NGUYEN VAN A" className={`${BARE_INPUT} uppercase`} />
          </IconInput>
        </Field>
        <p className="m-0 flex items-start gap-2 rounded-xl bg-[#eef6ff] px-3 py-2.5 text-[12.5px] leading-snug text-[#1e40af] dark:bg-[#16202c] dark:text-[#93c5fd]">
          <MaterialIcon name="info" size={17} filled color="currentColor" />
          <span>{t('referral.withdraw.shareNote')}</span>
        </p>
        {error && (
          <p role="alert" className="m-0 text-sm text-[#dc2626]">
            {error}
          </p>
        )}
      </div>
      <ModalActions cancelLabel={t('common.cancel')} okLabel={save.isPending ? t('referral.withdraw.saving') : t('referral.withdraw.save')} onCancel={onClose} onOk={submit} pending={save.isPending} disabled={!ok} />
    </SettingsModal>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-bold">
      {label}
      {children}
      {hint && <span className="text-xs font-normal text-stone-500">{hint}</span>}
    </label>
  );
}

/** Bước 1: nhập số tiền. Bước 2 (sau khi gửi): màn chờ chuyển khoản có mã tham chiếu, tự cập nhật khi đã chuyển (giống màn chờ thanh toán). */
function WithdrawModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('settings');
  const toast = useToast();
  const overview = useWithdraw();
  const w = overview.data!;
  const request = useRequestWithdraw();
  const [amount, setAmount] = useState(String(w.withdrawableCents));
  const [created, setCreated] = useState<Withdrawal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const live = useWithdrawalStatus(created?.id ?? null);
  const cur = live.data ?? created;

  const value = Number(digits(amount) || 0);
  const valid = value >= w.minCents && value <= w.withdrawableCents;

  if (cur) return <PendingView w={cur} onClose={onClose} onCopied={() => toast.success(t('referral.withdraw.copied'))} />;

  return (
    <SettingsModal title={t('referral.withdraw.wTitle')} onClose={onClose} busy={request.isPending}>
      <div className="flex flex-col gap-3.5">
        <div className="rounded-xl bg-[#fff7f1] px-4 py-3 text-sm">
          <div className="text-stone-600">{t('referral.withdraw.balance')}</div>
          <div className="text-[22px] font-extrabold">{vnd(w.withdrawableCents)}</div>
        </div>
        <Field label={t('referral.withdraw.wAmount')}>
          <div className="flex gap-2">
            <IconInput icon="payments" className="flex-1">
              <input value={value ? value.toLocaleString('vi-VN') : ''} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" className={BARE_INPUT} aria-label={t('referral.withdraw.wAmount')} />
              <span className="text-sm font-semibold text-stone-500">đ</span>
            </IconInput>
            <button type="button" onClick={() => setAmount(String(w.withdrawableCents))} className={`${OUTLINE_BTN} h-[50px] px-3.5`}>
              {t('referral.withdraw.wAll')}
            </button>
          </div>
        </Field>
        {value > 0 && !valid && (
          <p role="alert" className="m-0 text-sm text-[#dc2626]">
            {t('referral.withdraw.wInvalid', { min: vnd(w.minCents), max: vnd(w.withdrawableCents) })}
          </p>
        )}
        {w.account && (
          <div className="rounded-xl border border-[#f0ebe6] px-4 py-3 text-sm">
            <div className="text-stone-600">{t('referral.withdraw.wTo')}</div>
            <b>
              {w.account.bankName} {w.account.accountMasked}
            </b>
            <div className="text-xs text-stone-500">{w.account.accountHolder}</div>
          </div>
        )}
        {error && (
          <p role="alert" className="m-0 text-sm text-[#dc2626]">
            {error}
          </p>
        )}
      </div>
      <ModalActions
        cancelLabel={t('common.cancel')}
        okLabel={request.isPending ? t('referral.withdraw.wSending') : t('referral.withdraw.wConfirm')}
        onCancel={onClose}
        pending={request.isPending}
        disabled={!valid}
        onOk={() => request.mutate(value, { onSuccess: setCreated, onError: (e) => setError(errMsg(e, t('common.genericError'))) })}
      />
    </SettingsModal>
  );
}

function PendingView({ w, onClose, onCopied }: { w: Withdrawal; onClose: () => void; onCopied: () => void }) {
  const { t } = useTranslation('settings');
  const paid = w.status === 'paid';
  const rejected = w.status === 'rejected';
  const copy = () => void navigator.clipboard?.writeText(w.refCode).then(onCopied, () => undefined);
  return (
    <SettingsModal title={t('referral.withdraw.pTitle')} body={rejected ? undefined : t('referral.withdraw.pSub')} onClose={onClose}>
      <div className="flex flex-col items-center gap-3 py-1 text-center">
        <span className={`grid size-14 place-items-center rounded-full ${paid ? 'bg-[#dcfce7]' : rejected ? 'bg-[#fee2e2]' : 'bg-[#fff1e6]'}`}>
          <MaterialIcon name={paid ? 'check_circle' : rejected ? 'cancel' : 'hourglass_top'} size={32} filled color={paid ? '#16a34a' : rejected ? '#dc2626' : '#ff570a'} />
        </span>
        <div className="text-[16px] font-extrabold">{paid ? t('referral.withdraw.pPaid') : rejected ? t('referral.withdraw.rejected') : t('referral.withdraw.pWaiting')}</div>
        <div className="text-[26px] font-extrabold">{vnd(w.amountCents)}</div>
        <div className="w-full rounded-xl bg-[#fff7f1] px-4 py-3 text-left text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-stone-600">{t('referral.withdraw.pCode')}</span>
            <button type="button" onClick={copy} className="flex items-center gap-1.5 border-0 bg-transparent p-0 font-mono text-[15px] font-bold">
              {w.refCode}
              <MaterialIcon name="content_copy" size={16} />
            </button>
          </div>
          <Row k={t('referral.withdraw.bank')} v={`${w.bankName} •••• ${w.accountLast4}`} />
          <Row k={t('referral.withdraw.holder')} v={w.accountHolder} />
        </div>
        {rejected ? <p className="m-0 text-sm text-stone-600">{t('referral.withdraw.rejectedNote', { note: w.note ?? '—' })}</p> : !paid && <p className="m-0 text-[13px] text-stone-500">{t('referral.withdraw.pNote')}</p>}
      </div>
      <ModalActions cancelLabel={t('common.close')} okLabel={t('common.done')} onCancel={onClose} onOk={onClose} />
    </SettingsModal>
  );
}

function HistoryModal({ items, direct, onClose }: { items: Withdrawal[]; direct: DirectPayout[]; onClose: () => void }) {
  const { t } = useTranslation('settings');
  const tone: Record<Withdrawal['status'], string> = { requested: 'bg-[#fef3c7] text-[#b45309]', paid: 'bg-[#dcfce7] text-[#15803d]', rejected: 'bg-[#fee2e2] text-[#b91c1c]' };
  return (
    <SettingsModal title={t('referral.withdraw.hTitle')} onClose={onClose}>
      {items.length === 0 && direct.length === 0 ? (
        <p className="rounded-xl bg-[#faf7f4] px-4 py-5 text-center text-sm text-stone-500">{t('referral.withdraw.hEmpty')}</p>
      ) : (
        <ul className="m-0 flex max-h-[360px] list-none flex-col gap-2 overflow-y-auto p-0">
          {direct.map((d) => (
            <li key={d.id} className="rounded-xl border border-[#f0ebe6] px-3.5 py-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <b className="text-[15px]">{vnd(d.amountCents)}</b>
                <span className="rounded-lg bg-[#dcfce7] px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap text-[#15803d]">{t('referral.withdraw.directPaid')}</span>
              </div>
              <div className="mt-1 truncate text-xs text-stone-500" title={d.communityTitle}>{formatDate(d.createdAt)} · {d.communityTitle}</div>
              {d.note && <div className="mt-1 text-xs break-words text-stone-500">{d.note}</div>}
            </li>
          ))}
          {items.map((x) => (
            <li key={x.id} className="rounded-xl border border-[#f0ebe6] px-3.5 py-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <b className="text-[15px]">{vnd(x.amountCents)}</b>
                <span className={`rounded-lg px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap ${tone[x.status]}`}>{t(`referral.withdraw.${x.status}`)}</span>
              </div>
              <div className="mt-1 text-xs text-stone-500">
                {formatDate(x.createdAt)} · {x.bankName} •••• {x.accountLast4} · <span className="font-mono">{x.refCode}</span>
              </div>
              {x.status === 'rejected' && x.note && <div className="mt-1 text-xs text-[#b91c1c]">{t('referral.withdraw.rejectedNote', { note: x.note })}</div>}
            </li>
          ))}
        </ul>
      )}
      <ModalActions cancelLabel={t('common.close')} okLabel={t('common.done')} onCancel={onClose} onOk={onClose} />
    </SettingsModal>
  );
}

/** "Quy trình rút tiền": 4 bước. */
export function WithdrawProcess() {
  const { t } = useTranslation('settings');
  const q = useWithdraw();
  const min = vnd(q.data?.minCents ?? 200_000);
  const steps = [
    { n: '1', t: t('referral.withdraw.s1'), s: t('referral.withdraw.s1b', { min }) },
    { n: '2', t: t('referral.withdraw.s2'), s: t('referral.withdraw.s2b') },
    { n: '3', t: t('referral.withdraw.s3'), s: t('referral.withdraw.s3b') },
    { n: '4', t: t('referral.withdraw.s4'), s: t('referral.withdraw.s4b') },
  ];
  return (
    <section className="min-w-0 rounded-[20px] border border-[rgba(120,60,20,.07)] bg-white px-6 py-5">
      <h2 className="m-0 text-[18px] font-extrabold">{t('referral.withdraw.processTitle')}</h2>
      <p className="mt-1 mb-4 text-[13.5px] text-stone-500">{t('referral.withdraw.processSub')}</p>
      <div className="grid items-start gap-4 min-[1100px]:grid-cols-4">
        {steps.map((st, i) => (
          <div key={st.n} className="flex items-start gap-3.5">
            <span className="grid size-10 flex-none place-items-center rounded-full bg-brand text-[17px] font-extrabold text-white">{st.n}</span>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-extrabold">{st.t}</div>
              <div className="mt-1 text-[13px] leading-normal text-stone-500">{st.s}</div>
            </div>
            {i < steps.length - 1 && (
              <span className="hidden self-center min-[1100px]:block">
                <MaterialIcon name="arrow_forward" size={20} color="#ff570a" />
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

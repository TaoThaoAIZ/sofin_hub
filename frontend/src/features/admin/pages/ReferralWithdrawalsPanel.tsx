import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDateTime } from '../../../lib/datetime';
import { formatMoney } from '../../../lib/format';
import { ActionDialog, useDialogSlot } from '../components/Batch2Parts';
import { DataTable, MonoCell, MutedCell, NumCell, type Column, type RowAction } from '../components/DataTable';
import { useToast } from '../components/overlay';
import { StatusBadge, type Tone } from '../components/ui';
import { useAdminAction, useAdminList } from '../queries.batch2';

const LIMIT = 20;
type Status = 'requested' | 'paid' | 'rejected';

interface Withdrawal {
  id: string;
  amountCents: number;
  refCode: string;
  status: Status;
  bankName: string;
  accountHolder: string;
  accountLast4: string;
  note: string | null;
  createdAt: string;
  paidAt: string | null;
  user: { id: string; name: string; email: string };
  /** Chỉ có khi còn phải chuyển (status = requested): số tài khoản đầy đủ + QR VietQR điền sẵn số tiền & nội dung. */
  transfer: { bankName: string; accountNumber: string; accountHolder: string; amount: number; content: string; qrUrl: string } | null;
}

const TONE: Record<Status, Tone> = { requested: 'o', paid: 'g', rejected: 'x' };
const vnd = (n: number) => formatMoney(n, 'VND');

/** Dialog "Chuyển tiền": QR + thông tin chuyển khoản; SePay tự đối soát khi tiền ra khớp mã, hoặc admin bấm "Đã chuyển". */
function TransferDialog({ w, onClose }: { w: Withdrawal; onClose: () => void }) {
  const { t } = useTranslation('admin-payments');
  const toast = useToast();
  const act = useAdminAction();
  const x = w.transfer!;
  const copy = (text: string) => void navigator.clipboard?.writeText(text).then(() => toast.success(t('refWithdrawals.copied')), () => undefined);
  const row = (k: string, v: string, mono?: boolean) => (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-stone-500">{k}</span>
      <button type="button" onClick={() => copy(v)} className={`min-w-0 truncate border-0 bg-transparent p-0 text-right font-bold ${mono ? 'font-mono' : ''}`} title={t('refWithdrawals.clickCopy')}>
        {v}
      </button>
    </div>
  );
  return (
    <ActionDialog
      icon="account_balance"
      title={t('refWithdrawals.transferTitle')}
      body={t('refWithdrawals.transferBody', { amount: vnd(x.amount), name: w.user.name })}
      cta={t('refWithdrawals.markPaid')}
      noteLabel={t('common.noteOptional')}
      successMessage={t('refWithdrawals.paidDone')}
      run={(v) => act.mutateAsync({ path: `/payments/referral-withdrawals/${w.id}/mark-paid`, body: { note: v.note || undefined } })}
      onClose={onClose}
    >
      <div className="grid place-items-center gap-3">
        <img src={x.qrUrl} alt="VietQR" width={220} height={220} className="rounded-xl border border-[#f0ebe6] bg-white p-1" />
        <div className="flex w-full flex-col gap-1.5 rounded-xl bg-[#faf7f4] px-4 py-3">
          {row(t('refWithdrawals.bank'), x.bankName)}
          {row(t('refWithdrawals.accountNo'), x.accountNumber, true)}
          {row(t('refWithdrawals.holder'), x.accountHolder)}
          {row(t('refWithdrawals.amount'), String(x.amount))}
          {row(t('refWithdrawals.content'), x.content, true)}
        </div>
        <p className="m-0 text-center text-xs text-stone-500">{t('refWithdrawals.autoNote')}</p>
      </div>
    </ActionDialog>
  );
}

function RejectDialog({ w, onClose }: { w: Withdrawal; onClose: () => void }) {
  const { t } = useTranslation('admin-payments');
  const act = useAdminAction();
  return (
    <ActionDialog
      icon="cancel"
      danger
      title={t('refWithdrawals.rejectTitle')}
      body={t('refWithdrawals.rejectBody', { amount: vnd(w.amountCents), name: w.user.name })}
      cta={t('refWithdrawals.reject')}
      noteLabel={t('refWithdrawals.reason')}
      requireNote
      successMessage={t('refWithdrawals.rejectedDone')}
      run={(v) => act.mutateAsync({ path: `/payments/referral-withdrawals/${w.id}/reject`, body: { reason: v.note } })}
      onClose={onClose}
    />
  );
}

/** Admin > Giao dịch giới thiệu > "Yêu cầu rút": danh sách yêu cầu rút hoa hồng, QR để chuyển, duyệt tay / từ chối. */
export function ReferralWithdrawalsPanel({ viewTabs, onViewTab }: { viewTabs: { key: string; label: string }[]; onViewTab: (k: string) => void }) {
  const { t } = useTranslation('admin-payments');
  const slot = useDialogSlot();
  const [status, setStatus] = useState<'' | Status>('requested');
  const [page, setPage] = useState(1);
  const list = useAdminList<Withdrawal>('payments-referral-withdrawals', '/payments/referral-withdrawals', { status: status || undefined, page, limit: LIMIT });
  const m = list.data?.meta as { total: number } | undefined;
  const total = m?.total ?? 0;

  const columns: Column<Withdrawal>[] = [
    { key: 'date', label: t('refWithdrawals.colDate'), render: (x) => <MutedCell>{formatDateTime(x.createdAt)}</MutedCell> },
    { key: 'user', label: t('refWithdrawals.colUser'), w: 1.5, render: (x) => <MutedCell>{`${x.user.name} · ${x.user.email}`}</MutedCell> },
    { key: 'amt', label: t('common.amount'), render: (x) => <NumCell>{vnd(x.amountCents)}</NumCell> },
    { key: 'bank', label: t('refWithdrawals.bank'), w: 1.3, render: (x) => <MutedCell>{`${x.bankName} •••• ${x.accountLast4}`}</MutedCell> },
    { key: 'ref', label: t('refWithdrawals.content'), render: (x) => <MonoCell>{x.refCode}</MonoCell> },
    { key: 'st', label: t('common.status'), render: (x) => <StatusBadge tone={TONE[x.status]}>{t(`refWithdrawals.status.${x.status}`)}</StatusBadge> },
    { key: 'note', label: t('refWithdrawals.colNote'), w: 1.2, render: (x) => <MutedCell>{x.note ?? '—'}</MutedCell> },
  ];
  const actions = (x: Withdrawal): RowAction[] =>
    x.status !== 'requested'
      ? []
      : [
          { label: t('refWithdrawals.transfer'), icon: 'qr_code_2', onClick: () => slot.show((close) => <TransferDialog w={x} onClose={close} />) },
          { label: t('refWithdrawals.reject'), icon: 'cancel', danger: true, onClick: () => slot.show((close) => <RejectDialog w={x} onClose={close} />) },
        ];

  return (
    <>
      <DataTable<Withdrawal>
        title={t('refWithdrawals.tableTitle')}
        sub={t('refWithdrawals.tableSub', { count: total })}
        tabs={viewTabs}
        tab="withdrawals"
        onTab={onViewTab}
        filters={[
          {
            key: 'status',
            label: t('common.status'),
            value: status,
            options: (['requested', 'paid', 'rejected'] as const).map((value) => ({ value, label: t(`refWithdrawals.status.${value}`) })),
            onChange: (v: string) => {
              setStatus(v as '' | Status);
              setPage(1);
            },
          },
        ]}
        onClearFilters={() => {
          setStatus('');
          setPage(1);
        }}
        columns={columns}
        rows={list.data?.data ?? []}
        rowKey={(x) => x.id}
        loading={list.isPending}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        emptyText={t('refWithdrawals.empty')}
        actions={actions}
        page={{ page, totalPages: Math.max(1, Math.ceil(total / LIMIT)), total, limit: LIMIT, onPage: setPage }}
      />
      {slot.el}
    </>
  );
}

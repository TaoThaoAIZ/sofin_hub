import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatCents, formatDateTime } from '../../../lib/datetime';
import { ActionDialog, useDialogSlot } from '../components/Batch2Parts';
import { DataTable, MonoCell, MutedCell, NumCell, TextCell, type Column, type RowAction } from '../components/DataTable';
import { InputField, useToast } from '../components/overlay';
import { PageHeader } from '../components/PageHeader';
import { AdminButton, StatusBadge } from '../components/ui';
import { useAdminAction, useBankStatus, useBankTransactions, type BankScanResult, type BankTransaction } from '../queries.batch2';

const LIMIT = 20;

/** Duyệt tay: gán một giao dịch ngân hàng cho payment theo mã tham chiếu (refCode). */
function ApproveBankDialog({ tx, onClose }: { tx: BankTransaction; onClose: () => void }) {
  const { t } = useTranslation('admin-payments');
  const act = useAdminAction();
  const [refCode, setRefCode] = useState(tx.referenceCode ?? '');
  const code = refCode.trim();
  return (
    <ActionDialog
      icon="task_alt"
      title={t('bank.approveTitle')}
      body={t('bank.approveBody', { amount: formatCents(tx.amount), desc: tx.description })}
      cta={t('bank.approveCta')}
      noteLabel={t('common.noteOptional')}
      disabledExtra={code.length === 0}
      successMessage={t('bank.approved')}
      run={(v) =>
        act.mutateAsync({
          path: `/bank/payments/${encodeURIComponent(code)}/approve`,
          body: { bankTransactionId: tx.id, note: v.note || undefined },
        })
      }
      onClose={onClose}
    >
      <InputField label={t('bank.refCodeLabel')} value={refCode} onChange={setRefCode} placeholder={t('bank.refCodePlaceholder')} />
    </ActionDialog>
  );
}

/** Tiền vào ngân hàng: giao dịch SePay chưa khớp payment nào + nút "Quét ngay" + "Duyệt tay". */
export function BankInflowView() {
  const { t } = useTranslation('admin-payments');
  const toast = useToast();
  const slot = useDialogSlot();
  const [page, setPage] = useState(1);
  const status = useBankStatus();
  const [tab, setTab] = useState<'' | 'true' | 'false'>('');
  const list = useBankTransactions(page, LIMIT, tab);
  const act = useAdminAction();
  const total = list.data?.total ?? 0;
  const configured = status.data?.configured;

  const scan = () =>
    act.mutate(
      { path: '/bank/scan' },
      {
        onSuccess: (d) => {
          const r = d as BankScanResult;
          toast.success(t('bank.scanDone', { scanned: r.scanned, credited: r.credited, already: r.already, unmatched: r.unmatched, underpaid: r.underpaid, errors: r.errors, skipped: r.skipped }));
        },
        onError: (e) => toast.error(e instanceof Error && e.message ? e.message : t('bank.scanFailed')),
      },
    );

  const columns: Column<BankTransaction>[] = [
    { key: 'date', label: t('bank.colDate'), render: (x) => <MutedCell>{formatDateTime(x.transactionDate)}</MutedCell> },
    { key: 'amt', label: t('common.amount'), render: (x) => <NumCell>{formatCents(x.amount)}</NumCell> },
    { key: 'desc', label: t('bank.colDesc'), w: 2.2, render: (x) => <TextCell>{x.description}</TextCell> },
    { key: 'ref', label: t('bank.colRef'), render: (x) => <MonoCell>{x.referenceCode ?? '—'}</MonoCell> },
    { key: 'gw', label: t('bank.colBank'), render: (x) => <MutedCell>{x.gateway}</MutedCell> },
    { key: 'st', label: t('bank.colStatus'), render: (x) => <StatusBadge tone={x.credited ? 'g' : 'o'}>{x.credited ? t('bank.statusCredited') : t('bank.statusPending')}</StatusBadge> },
    { key: 'note', label: t('bank.colNote'), w: 1.6, render: (x) => <MutedCell>{x.note ?? '—'}</MutedCell> },
  ];
  const actions = (x: BankTransaction): RowAction[] => (x.credited ? [] : [{ label: t('bank.approveBtn'), icon: 'task_alt', onClick: () => slot.show((close) => <ApproveBankDialog tx={x} onClose={close} />) }]);

  return (
    <>
      <PageHeader
        title={t('bank.pageTitle')}
        subtitle={t('bank.pageSubtitle')}
        actions={
          <AdminButton kind="primary" icon="sync" onClick={scan} disabled={act.isPending || configured === false}>
            {act.isPending ? t('bank.scanning') : t('bank.scanNow')}
          </AdminButton>
        }
      />
      {configured === false && (
        <div role="alert" className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13.5px] text-amber-900">
          <span className="font-bold">{t('bank.notConfiguredTitle')}</span>
          <span>{t('bank.notConfiguredBody')}</span>
        </div>
      )}
      <DataTable<BankTransaction>
        title={t('bank.tableTitle')}
        sub={t('bank.tableSub', { count: total })}
        tabs={[
          { key: '', label: t('common.all') },
          { key: 'false', label: t('bank.tabPending') },
          { key: 'true', label: t('bank.tabCredited') },
        ]}
        tab={tab}
        onTab={(k) => {
          setTab(k as '' | 'true' | 'false');
          setPage(1);
        }}
        columns={columns}
        rows={list.data?.data ?? []}
        rowKey={(x) => x.id}
        loading={list.isPending}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        emptyText={t('bank.empty')}
        actions={actions}
        page={{ page, totalPages: Math.max(1, Math.ceil(total / LIMIT)), total, limit: LIMIT, onPage: setPage }}
      />
      {slot.el}
    </>
  );
}

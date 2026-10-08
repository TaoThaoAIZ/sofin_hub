import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useEffect, useState } from 'react';
import { currentLocale } from '../../../i18n';
import { formatDateTime, formatRelative } from '../../../lib/datetime';
import { ActionDialog, useDialogSlot, useTableState } from '../components/Batch2Parts';
import { SettingInput, SettingRow, Toggle } from '../components/Batch3Parts';
import { DataTable, MainCell, MutedCell, Segment, TextCell, type Column, type RowAction } from '../components/DataTable';
import { InputField, OptionChips, TextAreaField, useToast } from '../components/overlay';
import { PageHeader } from '../components/PageHeader';
import { AdminButton, Card, EmptyBlock, ErrorBlock, LoadingBlock, StatusBadge, errMessage } from '../components/ui';
import { useAdminAction, useAdminData, useAdminList } from '../queries.batch2';
import {
  FLAG_STAGE,
  INTEGRATION_CATEGORY,
  type Broadcast,
  type BroadcastAudience,
  type FeatureFlag,
  type FlagStage,
  type Integration,
  type NotificationSettings,
  type PlatformSettings,
} from '../types.batch3';

const STAGE_OPTS = (Object.keys(FLAG_STAGE) as FlagStage[]).map((k) => ({ value: k, label: FLAG_STAGE[k].label }));

/* ============================== Tính năng thử nghiệm ============================== */

function FlagFormDialog({ flag, onClose }: { flag?: FeatureFlag; onClose: () => void }) {
  const { t } = useTranslation('admin-system');
  const act = useAdminAction();
  const [key, setKey] = useState(flag?.key ?? '');
  const [name, setName] = useState(flag?.name ?? '');
  const [desc, setDesc] = useState(flag?.description ?? '');
  const [stage, setStage] = useState<string>(flag?.stage ?? 'draft');
  const [rollout, setRollout] = useState(String(flag?.rolloutPercent ?? 100));
  const r = Number(rollout);
  const rolloutOk = rollout !== '' && Number.isInteger(r) && r >= 0 && r <= 100;
  return (
    <ActionDialog
      icon="flag"
      title={flag ? t('flags.editTitle', { name: flag.name }) : t('flags.addTitle')}
      body={flag ? undefined : t('flags.addBody')}
      cta={flag ? t('common.save') : t('flags.add')}
      disabledExtra={!name.trim() || !rolloutOk || (!flag && !/^[a-z0-9_]+$/.test(key))}
      successMessage={flag ? t('flags.updated') : t('flags.added')}
      run={() =>
        flag
          ? act.mutateAsync({ method: 'PATCH', path: `/system/flags/${flag.key}`, body: { name: name.trim(), description: desc.trim(), stage, rolloutPercent: r } })
          : act.mutateAsync({ path: '/system/flags', body: { key, name: name.trim(), description: desc.trim() || undefined, stage, rolloutPercent: r } })
      }
      onClose={onClose}
    >
      {!flag && <InputField label={t('flags.keyLabel')} value={key} onChange={(v) => setKey(v.toLowerCase())} placeholder={t('flags.keyPlaceholder')} mono maxLength={60} />}
      <InputField label={t('common.displayName')} value={name} onChange={setName} maxLength={80} />
      <TextAreaField label={t('common.description')} value={desc} onChange={setDesc} maxLength={300} />
      <OptionChips label={t('flags.stage')} options={STAGE_OPTS} value={stage} onChange={(v) => setStage(v as string)} />
      <InputField label={t('flags.rollout')} value={rollout} onChange={(v) => setRollout(v.replace(/\D/g, '').slice(0, 3))} />
    </ActionDialog>
  );
}

export function FlagsView() {
  const { t } = useTranslation('admin-system');
  const ts = useTableState({ stage: '' });
  const slot = useDialogSlot();
  const toast = useToast();
  const act = useAdminAction();
  const [busy, setBusy] = useState<string | null>(null);
  const q = useAdminData<FeatureFlag[]>('system', '/system/flags', { q: ts.q || undefined, stage: ts.f.stage || undefined });

  const toggle = async (f: FeatureFlag, enabled: boolean) => {
    setBusy(f.key);
    try {
      await act.mutateAsync({ path: `/system/flags/${f.key}/toggle`, body: { enabled } });
      toast.success(t(enabled ? 'flags.enabledToast' : 'flags.disabledToast', { name: f.name }));
    } catch (e) {
      toast.error(errMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const columns: Column<FeatureFlag>[] = [
    { key: 'f', label: t('flags.feature'), w: 1.8, render: (f) => <MainCell name={f.name} sub={f.key} icon="flag" /> },
    { key: 'd', label: t('common.description'), w: 2, render: (f) => <TextCell>{f.description || '—'}</TextCell> },
    {
      key: 'r',
      label: t('flags.rolloutCol'),
      render: (f) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <StatusBadge tone={FLAG_STAGE[f.stage]?.tone ?? 'x'}>{FLAG_STAGE[f.stage]?.label ?? f.stage}</StatusBadge>
          {f.rolloutPercent < 100 && <span className="text-xs text-stone-500">{f.rolloutPercent}%</span>}
        </span>
      ),
    },
    { key: 'u', label: t('flags.updatedCol'), render: (f) => <MutedCell>{formatRelative(f.updatedAt)}</MutedCell> },
    { key: 'on', label: t('flags.onCol'), w: 0.6, render: (f) => <Toggle on={f.enabled} disabled={busy === f.key} label={t('flags.toggleLabel', { name: f.name })} onChange={(v) => void toggle(f, v)} /> },
  ];

  const actions = (f: FeatureFlag): RowAction[] => [
    { label: t('common.edit'), icon: 'edit', onClick: () => slot.show((close) => <FlagFormDialog flag={f} onClose={close} />) },
    {
      label: t('common.delete'),
      icon: 'delete',
      danger: true,
      onClick: () =>
        slot.show((close) => (
          <ActionDialog icon="delete" danger title={t('flags.deleteTitle', { name: f.name })} body={t('flags.deleteBody')} cta={t('common.delete')} successMessage={t('flags.deleted')} run={() => act.mutateAsync({ method: 'DELETE', path: `/system/flags/${f.key}` })} onClose={close} />
        )),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('flags.pageTitle')}
        subtitle={t('flags.pageSubtitle')}
        actions={
          <AdminButton kind="primary" icon="add" onClick={() => slot.show((close) => <FlagFormDialog onClose={close} />)}>
            {t('flags.add')}
          </AdminButton>
        }
      />
      <DataTable<FeatureFlag>
        columns={columns}
        rows={q.data ?? []}
        rowKey={(f) => f.key}
        actions={actions}
        search={{ value: ts.q, onChange: ts.onQ, placeholder: t('flags.searchPlaceholder') }}
        filters={[{ key: 'stage', label: t('flags.stageFilter'), value: ts.f.stage, options: STAGE_OPTS, onChange: ts.setFilter('stage') }]}
        onClearFilters={ts.clear}
        loading={q.isPending}
        error={q.isError ? q.error : null}
        onRetry={() => void q.refetch()}
        emptyText={t('flags.empty')}
      />
      {slot.el}
    </>
  );
}

/* ============================== Tích hợp ============================== */

const INT_DESC: Record<string, string> = {
  stripe: 'integrations.desc.stripe',
  paypal: 'integrations.desc.paypal',
  momo: 'integrations.desc.momo',
  zoom: 'integrations.desc.zoom',
  google_analytics: 'integrations.desc.googleAnalytics',
  mailgun: 'integrations.desc.mailgun',
  slack: 'integrations.desc.slack',
  cloudflare: 'integrations.desc.cloudflare',
};

function ConnectDialog({ it, onClose }: { it: Integration; onClose: () => void }) {
  const { t } = useTranslation('admin-system');
  const act = useAdminAction();
  const [key, setKey] = useState('');
  return (
    <ActionDialog
      icon="link"
      title={t('integrations.connectTitle', { name: it.name })}
      body={t('integrations.connectBody')}
      cta={t('integrations.connect')}
      successMessage={t('integrations.connected', { name: it.name })}
      run={() => act.mutateAsync({ path: `/system/integrations/${it.key}/connect`, body: { apiKey: key.trim() || undefined } })}
      onClose={onClose}
    >
      <InputField label={t('integrations.apiKeyOptional')} value={key} onChange={setKey} placeholder="sk_live_…" mono />
    </ActionDialog>
  );
}

function IntegrationCard({ it, onConnect, onDisconnect, onTest, testing }: { it: Integration; onConnect: () => void; onDisconnect: () => void; onTest: () => void; testing: boolean }) {
  const { t } = useTranslation('admin-system');
  return (
    <div className="flex flex-col gap-3 rounded-[18px] border border-[#f1ebe6] bg-white p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-[42px] flex-none place-items-center rounded-xl text-[13px] font-extrabold text-white" style={{ background: it.color }}>
          {it.initials}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-bold">{it.name}</div>
          <div className={`mt-0.5 text-[12.5px] font-semibold ${it.connected ? 'text-[#15803d]' : 'text-stone-400'}`}>{it.connected ? t('integrations.statusConnected') : t('integrations.statusNotConnected')}</div>
        </div>
        <span className="rounded-full bg-[#f5f1ed] px-2 py-0.5 text-[11px] font-semibold text-stone-500">{INTEGRATION_CATEGORY[it.category] ?? it.category}</span>
      </div>
      <p className="m-0 text-[13px] leading-relaxed text-stone-500">{INT_DESC[it.key] ? t(INT_DESC[it.key]!) : it.description}</p>
      {it.connected && (
        <div className="text-xs text-stone-400">
          {it.secretMask && <span>{t('integrations.keyMask', { mask: it.secretMask })}</span>}
          {it.connectedAt && <span>{t('integrations.connectedAt', { when: formatRelative(it.connectedAt) })}</span>}
        </div>
      )}
      <div className="mt-auto flex gap-2">
        {it.connected ? (
          <>
            <AdminButton className="flex-1" onClick={onDisconnect}>
              {t('integrations.disconnect')}
            </AdminButton>
            <AdminButton icon="network_check" disabled={testing} onClick={onTest}>
              {testing ? t('integrations.testing') : t('integrations.test')}
            </AdminButton>
          </>
        ) : (
          <AdminButton kind="primary" className="flex-1" onClick={onConnect}>
            {t('integrations.connect')}
          </AdminButton>
        )}
      </div>
    </div>
  );
}

export function IntegrationsView() {
  const { t } = useTranslation('admin-system');
  const q = useAdminData<Integration[]>('system', '/system/integrations');
  const slot = useDialogSlot();
  const toast = useToast();
  const act = useAdminAction();
  const [testing, setTesting] = useState<string | null>(null);

  const test = async (it: Integration) => {
    setTesting(it.key);
    try {
      const r = (await act.mutateAsync({ path: `/system/integrations/${it.key}/test`, body: {} })) as { ok: boolean; message: string; latencyMs: number } | undefined;
      if (r?.ok) toast.success(r.latencyMs != null ? t('integrations.testOkMs', { name: it.name, ms: r.latencyMs }) : t('integrations.testOk', { name: it.name }));
      else toast.error(t('integrations.testResult', { name: it.name, message: r?.message ?? t('integrations.testFailed') }));
    } catch (e) {
      toast.error(errMessage(e));
    } finally {
      setTesting(null);
    }
  };

  return (
    <>
      <PageHeader title={t('integrations.pageTitle')} subtitle={t('integrations.pageSubtitle')} />
      <Card title={t('integrations.connectedServices')}>
        {q.isPending && <LoadingBlock />}
        {q.isError && <ErrorBlock error={q.error} onRetry={() => void q.refetch()} />}
        {q.data && q.data.length === 0 && <EmptyBlock>{t('integrations.empty')}</EmptyBlock>}
        {q.data && q.data.length > 0 && (
          <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))' }}>
            {q.data.map((it) => (
              <IntegrationCard
                key={it.key}
                it={it}
                testing={testing === it.key}
                onConnect={() => slot.show((close) => <ConnectDialog it={it} onClose={close} />)}
                onTest={() => void test(it)}
                onDisconnect={() =>
                  slot.show((close) => (
                    <ActionDialog icon="link_off" danger title={t('integrations.disconnectTitle', { name: it.name })} body={t('integrations.disconnectBody')} cta={t('integrations.disconnect')} successMessage={t('integrations.disconnected', { name: it.name })} run={() => act.mutateAsync({ path: `/system/integrations/${it.key}/disconnect`, body: {} })} onClose={close} />
                  ))
                }
              />
            ))}
          </div>
        )}
      </Card>
      {slot.el}
    </>
  );
}

/* ============================== Thông báo ============================== */

type NGroup = 'moderation' | 'payments' | 'reports';

function AlertForm({ title, sub, group, rows, value, onChange, children }: { title: string; sub: string; group: NGroup; rows: { key: string; label: string; hint?: string }[]; value: NotificationSettings; onChange: (v: NotificationSettings) => void; children?: React.ReactNode }) {
  const g = value[group] as unknown as Record<string, boolean | string>;
  const set = (k: string, v: boolean | string) => onChange({ ...value, [group]: { ...value[group], [k]: v } } as NotificationSettings);
  return (
    <Card title={title} sub={sub}>
      <div className="flex flex-col">
        {rows.map((r) => (
          <SettingRow key={r.key} label={r.label} hint={r.hint}>
            <Toggle on={!!g[r.key]} label={r.label} onChange={(v) => set(r.key, v)} />
          </SettingRow>
        ))}
        {children}
      </div>
    </Card>
  );
}

const audiences = (t: TFunction) => [
  { value: 'all', label: t('broadcast.audAll') },
  { value: 'creators', label: t('broadcast.audCreators') },
  { value: 'paid_members', label: t('broadcast.audPaid') },
  { value: 'community', label: t('broadcast.audCommunity') },
];
const audLabel = (t: TFunction, a: BroadcastAudience) => audiences(t).find((x) => x.value === a.type)?.label ?? a.type;

function BroadcastCard() {
  const { t } = useTranslation('admin-system');
  const act = useAdminAction();
  const toast = useToast();
  const slot = useDialogSlot();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [link, setLink] = useState('');
  const [type, setType] = useState('all');
  const [courseId, setCourseId] = useState('');
  const [email, setEmail] = useState(false);
  const audience: BroadcastAudience = type === 'community' ? { type: 'community', courseId: courseId.trim() } : ({ type } as BroadcastAudience);
  const ready = !!title.trim() && !!body.trim() && (type !== 'community' || !!courseId.trim());

  const send = () =>
    slot.show((close) => (
      <ActionDialog
        icon="campaign"
        title={t('broadcast.sendTitle')}
        body={t('broadcast.sendBody', { title: title.trim(), audience: audLabel(t, audience).toLowerCase() })}
        cta={t('broadcast.send')}
        successMessage={t('broadcast.sent')}
        run={async () => {
          await act.mutateAsync({ path: '/system/notifications/broadcast', body: { title: title.trim(), body: body.trim(), link: link.trim() || undefined, audience, sendEmail: email } });
          setTitle('');
          setBody('');
          setLink('');
        }}
        onClose={close}
      />
    ));

  const preview = async () => {
    try {
      const r = (await act.mutateAsync({ path: '/system/notifications/preview', body: { audience } })) as { recipientCount: number } | undefined;
      toast.success(t('broadcast.previewToast', { n: (r?.recipientCount ?? 0).toLocaleString(currentLocale()) }));
    } catch (e) {
      toast.error(errMessage(e));
    }
  };

  return (
    <Card title={t('broadcast.cardTitle')} sub={t('broadcast.cardSubtitle')}>
      <InputField label={t('broadcast.title')} value={title} onChange={setTitle} maxLength={120} />
      <TextAreaField label={t('common.content')} value={body} onChange={setBody} maxLength={1000} />
      <InputField label={t('broadcast.link')} value={link} onChange={setLink} placeholder="/communities/…" />
      <OptionChips label={t('broadcast.audience')} options={audiences(t)} value={type} onChange={(v) => setType(v as string)} />
      {type === 'community' && <InputField label={t('broadcast.communityId')} value={courseId} onChange={setCourseId} placeholder={t('broadcast.communityIdPlaceholder')} />}
      <label className="flex items-center gap-2 text-[13.5px]">
        <Toggle on={email} onChange={setEmail} label={t('broadcast.alsoEmail')} />
        {t('broadcast.alsoEmail')}
      </label>
      <div className="flex flex-wrap gap-2">
        <AdminButton icon="groups" disabled={!ready && type === 'community' && !courseId.trim()} onClick={() => void preview()}>
          {t('broadcast.previewCount')}
        </AdminButton>
        <AdminButton kind="primary" icon="campaign" disabled={!ready} onClick={send}>
          {t('broadcast.send')}
        </AdminButton>
      </div>
      {slot.el}
    </Card>
  );
}

function BroadcastHistory() {
  const { t } = useTranslation('admin-system');
  const ts = useTableState({});
  const list = useAdminList<Broadcast>('system', '/system/notifications/broadcasts', { page: ts.page, limit: 10 });
  return (
    <DataTable<Broadcast>
      title={t('broadcast.historyTitle')}
      columns={[
        { key: 't', label: t('notifications.rowHistory'), w: 2, render: (b) => <MainCell name={b.title} sub={b.body} icon="campaign" /> },
        { key: 'a', label: t('broadcast.audienceCol'), render: (b) => <TextCell>{audLabel(t, b.audience)}</TextCell> },
        { key: 'r', label: t('broadcast.recipientsCol'), render: (b) => <TextCell>{b.recipientCount.toLocaleString(currentLocale())}</TextCell> },
        { key: 'e', label: 'Email', w: 0.7, render: (b) => <TextCell>{b.emailCount.toLocaleString(currentLocale())}</TextCell> },
        { key: 's', label: t('broadcast.sentBy'), render: (b) => <TextCell>{b.sentBy.name}</TextCell> },
        { key: 'c', label: t('broadcast.time'), render: (b) => <MutedCell>{formatDateTime(b.createdAt)}</MutedCell> },
      ]}
      rows={list.data?.data ?? []}
      rowKey={(b) => b.id}
      loading={list.isPending}
      error={list.isError ? list.error : null}
      onRetry={() => void list.refetch()}
      emptyText={t('broadcast.historyEmpty')}
      page={list.data ? { page: list.data.meta.page, totalPages: list.data.meta.totalPages, total: list.data.meta.total, limit: 10, onPage: ts.setPage } : undefined}
    />
  );
}

export function NotificationsView() {
  const { t } = useTranslation('admin-system');
  const q = useAdminData<NotificationSettings>('system', '/system/notifications/settings');
  const act = useAdminAction();
  const toast = useToast();
  const [draft, setDraft] = useState<NotificationSettings | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (q.data) setDraft(q.data);
  }, [q.data]);
  const dirty = !!draft && !!q.data && JSON.stringify(draft) !== JSON.stringify(q.data);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await act.mutateAsync({ method: 'PUT', path: '/system/notifications/settings', body: draft });
      toast.success(t('notifications.saved'));
    } catch (e) {
      toast.error(errMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title={t('common.notifications')}
        subtitle={t('notifications.pageSubtitle')}
        actions={
          <>
            {dirty && (
              <AdminButton onClick={() => q.data && setDraft(q.data)} disabled={saving}>
                {t('common.undo')}
              </AdminButton>
            )}
            <AdminButton kind="primary" icon="save" disabled={!dirty || saving} onClick={() => void save()}>
              {saving ? t('common.saving') : t('common.saveChanges')}
            </AdminButton>
          </>
        }
      />
      {q.isPending && <LoadingBlock />}
      {q.isError && <ErrorBlock error={q.error} onRetry={() => void q.refetch()} />}
      {draft && (
        <>
          <div className="grid items-start gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))' }}>
            <AlertForm
              title={t('notifications.moderationTitle')}
              sub={t('notifications.moderationSub')}
              group="moderation"
              value={draft}
              onChange={setDraft}
              rows={[
                { key: 'criticalReports', label: t('notifications.criticalReports'), hint: t('notifications.criticalHint') },
                { key: 'pendingCommunities', label: t('notifications.pendingCommunities') },
                { key: 'aiFlagged', label: t('notifications.aiFlagged') },
              ]}
            />
            <AlertForm
              title={t('notifications.paymentsTitle')}
              sub={t('notifications.paymentsSub')}
              group="payments"
              value={draft}
              onChange={setDraft}
              rows={[
                { key: 'newChargeback', label: t('notifications.newChargeback') },
                { key: 'failedPayout', label: t('notifications.failedPayout') },
                { key: 'refundOver500', label: t('notifications.refundOver500') },
              ]}
            />
          </div>
          <AlertForm
            title={t('notifications.reportsTitle')}
            sub={t('notifications.reportsSub')}
            group="reports"
            value={draft}
            onChange={setDraft}
            rows={[
              { key: 'weeklySummary', label: t('notifications.weeklySummary') },
              { key: 'monthlyBoardReport', label: t('notifications.monthlyReport') },
            ]}
          >
            <SettingRow label={t('notifications.sendTo')} hint={t('notifications.sendToHint')}>
              <SettingInput label={t('notifications.recipientEmail')} value={draft.reports.sendTo} onChange={(v) => setDraft({ ...draft, reports: { ...draft.reports, sendTo: v } })} placeholder="ops@sofinhub.com" />
            </SettingRow>
          </AlertForm>
          <p className="m-0 text-xs text-stone-400">{t('notifications.storedOnlyNote')}</p>
        </>
      )}
      <BroadcastCard />
      <BroadcastHistory />
    </>
  );
}

/* ============================== Cài đặt chung ============================== */

type GroupKey = 'platform' | 'payments' | 'security' | 'referral';

const OVERRIDE_KEYS: Record<string, string> = {
  commissionPct: 'payments.commissionPct',
  gatewayFeePct: 'payments.gatewayFeePct',
  gatewayFeeFixedCents: 'payments.gatewayFeeFixedCents',
  refundWindowDays: 'payments.refundWindowDays',
  payoutMinUsd: 'payments.payoutMinUsd',
  trialDays: 'payments.trialDays',
  subscriptionPeriodDays: 'payments.subscriptionPeriodDays',
  creatorRateBps: 'referral.creatorRateBps',
  memberRateBps: 'referral.memberRateBps',
  attributionDays: 'referral.attributionDays',
  payoutDay: 'referral.payoutDay',
};

export function SettingsView() {
  const { t } = useTranslation('admin-system');
  const q = useAdminData<PlatformSettings>('system', '/system/settings');
  const act = useAdminAction();
  const toast = useToast();
  const slot = useDialogSlot();
  const [draft, setDraft] = useState<PlatformSettings | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (q.data) setDraft(q.data);
  }, [q.data]);

  const orig = q.data;
  const dirty = !!draft && !!orig && (['platform', 'payments', 'security', 'referral'] as GroupKey[]).some((g) => JSON.stringify(draft[g]) !== JSON.stringify(orig[g]));

  const setG = <G extends GroupKey>(g: G, patch: Partial<PlatformSettings[G]>) => draft && setDraft({ ...draft, [g]: { ...draft[g], ...patch } });
  const num = (v: string) => (v.trim() === '' ? NaN : Number(v.replace(',', '.')));

  const validate = (): string | null => {
    if (!draft) return null;
    const p = draft.payments;
    const checks: [number, number, number, string][] = [
      [p.commissionPct, 0, 100, t('settings.checkCommission')],
      [p.gatewayFeePct, 0, 100, t('settings.checkGatewayFee')],
      [p.refundWindowDays, 0, 365, t('settings.checkRefundWindow')],
      [p.payoutMinUsd, 0, 100000, t('settings.payoutMin')],
      [p.trialDays, 0, 365, t('settings.checkTrial')],
      [p.subscriptionPeriodDays, 1, 365, t('settings.checkPeriod')],
      [p.gatewayFeeFixedCents, 0, 100000, t('settings.checkFixedFee')],
    ];
    for (const [v, lo, hi, label] of checks) if (!Number.isFinite(v) || v < lo || v > hi) return t('settings.invalidField', { label });
    const r = draft.referral;
    if (r) {
      const rc: [number, number, number, string][] = [
        [r.creatorRateBps, 0, 10000, t('settings.refCreatorRate')],
        [r.memberRateBps, 0, 10000, t('settings.refMemberRate')],
        [r.attributionDays, 1, 3650, t('settings.refAttributionDays')],
        [r.payoutDay, 1, 28, t('settings.refPayoutDay')],
      ];
      for (const [v, lo, hi, label] of rc) if (!Number.isInteger(v) || v < lo || v > hi) return t('settings.invalidField', { label });
    }
    if (!draft.platform.name.trim()) return t('settings.nameRequired');
    if (!/^\S+@\S+\.\S+$/.test(draft.platform.supportEmail.trim())) return t('settings.emailInvalid');
    return null;
  };
  const problem = validate();

  const save = async () => {
    if (!draft || !orig) return;
    const patch: Record<string, unknown> = {};
    (['platform', 'payments', 'security', 'referral'] as GroupKey[]).forEach((g) => {
      if (!draft[g] || !orig[g]) return;
      const changed = Object.fromEntries(Object.entries(draft[g]).filter(([k, v]) => v !== (orig[g] as unknown as Record<string, unknown>)[k]));
      if (Object.keys(changed).length > 0) patch[g] = changed;
    });
    setSaving(true);
    try {
      await act.mutateAsync({ method: 'PATCH', path: '/system/settings', body: patch });
      toast.success(t('settings.saved'));
    } catch (e) {
      toast.error(errMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const resetKeys = (keys: string[], label: string) =>
    slot.show((close) => (
      <ActionDialog icon="restart_alt" title={t('settings.resetTitle', { label })} body={t('settings.resetBody')} cta={t('common.restore')} successMessage={t('settings.resetDone')} run={() => act.mutateAsync({ path: '/system/settings/reset', body: { keys } })} onClose={close} />
    ));

  const onMaintenance = (v: boolean) => {
    if (!v) return setG('security', { maintenanceMode: false });
    slot.show((close) => (
      <ActionDialog
        icon="construction"
        danger
        title={t('settings.maintenanceTitle')}
        body={t('settings.maintenanceBody')}
        cta={t('settings.enableOnSave')}
        successMessage={t('settings.maintenanceSet')}
        run={async () => setG('security', { maintenanceMode: true })}
        onClose={close}
      />
    ));
  };

  const over = (field: string) => {
    const o = orig?.overrides[OVERRIDE_KEYS[field] ?? ''];
    return o?.overridden ? (
      <button type="button" className="ml-3 border-0 bg-transparent p-0 text-xs font-semibold text-brand hover:underline" onClick={() => resetKeys([OVERRIDE_KEYS[field]!], field)}>
        {t('settings.defaultRestore', { value: String(o.default) })}
      </button>
    ) : null;
  };
  const refRow = (field: keyof PlatformSettings['referral'], label: string, hint: string, suffix: string) => (
    <SettingRow key={field} label={label} hint={hint}>
      <div className="flex items-center gap-2">
        <SettingInput label={label} width={110} value={String(draft!.referral[field] ?? '')} onChange={(v) => setG('referral', { [field]: num(v) } as Partial<PlatformSettings['referral']>)} />
        <span className="text-xs text-stone-500">{suffix}</span>
        {over(field as string)}
      </div>
    </SettingRow>
  );
  const numRow = (g: 'payments', field: keyof PlatformSettings['payments'], label: string, hint: string, suffix: string) => (
    <SettingRow key={field} label={label} hint={hint}>
      <div className="flex items-center gap-2">
        <SettingInput
          label={label}
          width={110}
          value={String(draft!.payments[field] ?? '')}
          onChange={(v) => setG(g, { [field]: num(v) } as Partial<PlatformSettings['payments']>)}
        />
        <span className="text-xs text-stone-500">{suffix}</span>
        {over(field as string)}
      </div>
    </SettingRow>
  );

  return (
    <>
      <PageHeader
        title={t('settings.pageTitle')}
        subtitle={t('settings.pageSubtitle')}
        actions={
          <>
            {dirty && (
              <AdminButton disabled={saving} onClick={() => orig && setDraft(orig)}>
                {t('common.undo')}
              </AdminButton>
            )}
            <AdminButton kind="primary" icon="save" disabled={!dirty || saving || !!problem} onClick={() => void save()}>
              {saving ? t('common.saving') : t('common.saveChanges')}
            </AdminButton>
          </>
        }
      />
      {q.isPending && <LoadingBlock />}
      {q.isError && <ErrorBlock error={q.error} onRetry={() => void q.refetch()} />}
      {dirty && problem && (
        <div role="alert" className="rounded-xl bg-[#fef2f2] px-3.5 py-2.5 text-[13px] font-medium text-[#b91c1c]">
          {problem}
        </div>
      )}
      {draft && (
        <>
          <div className="grid items-start gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))' }}>
            <Card title={t('settings.platform')} sub={t('settings.platformSub')}>
              <SettingRow label={t('settings.platformName')}>
                <SettingInput label={t('settings.platformName')} value={draft.platform.name} onChange={(v) => setG('platform', { name: v })} />
              </SettingRow>
              <SettingRow label={t('settings.supportEmail')}>
                <SettingInput label={t('settings.supportEmail')} value={draft.platform.supportEmail} onChange={(v) => setG('platform', { supportEmail: v })} />
              </SettingRow>
              <SettingRow label={t('settings.defaultLanguage')}>
                <Segment
                  label={t('settings.defaultLanguage')}
                  value={draft.platform.defaultLanguage}
                  onChange={(v) => setG('platform', { defaultLanguage: v })}
                  options={[
                    { value: 'en', label: t('settings.langEn') },
                    { value: 'vi', label: t('settings.langVi') },
                  ]}
                />
              </SettingRow>
              <SettingRow label={t('settings.timezone')} hint={t('common.storedOnly')}>
                <SettingInput label={t('settings.timezone')} value={draft.platform.timezone} onChange={(v) => setG('platform', { timezone: v })} />
              </SettingRow>
            </Card>
            <Card title={t('settings.security')} sub={t('settings.securitySub')}>
              <SettingRow label={t('settings.require2fa')} hint={t('settings.require2faHint')}>
                <Toggle on={draft.security.require2fa} label={t('settings.require2faShort')} onChange={(v) => setG('security', { require2fa: v })} />
              </SettingRow>
              <SettingRow label={t('settings.autoSignOut')} hint={t('common.storedOnly')}>
                <Segment
                  label={t('settings.autoSignOut')}
                  value={String(draft.security.sessionTimeoutMin)}
                  onChange={(v) => setG('security', { sessionTimeoutMin: Number(v) })}
                  options={[
                    { value: '15', label: t('settings.min15') },
                    { value: '30', label: t('settings.min30') },
                    { value: '120', label: t('settings.hours2') },
                  ]}
                />
              </SettingRow>
              <SettingRow label={t('settings.maintenance')} hint={t('settings.maintenanceHint')}>
                <Toggle on={draft.security.maintenanceMode} label={t('settings.maintenance')} onChange={onMaintenance} />
              </SettingRow>
            </Card>
          </div>
          <Card title={t('common.payments')} sub={t('settings.paymentsSub')}>
            {numRow('payments', 'commissionPct', t('settings.commission'), t('settings.commissionHint'), '%')}
            {numRow('payments', 'gatewayFeePct', t('settings.gatewayFeePct'), t('common.appliesImmediately'), '%')}
            {numRow('payments', 'gatewayFeeFixedCents', t('settings.gatewayFeeFixed'), t('settings.gatewayFeeFixedHint'), t('settings.cents'))}
            {numRow('payments', 'refundWindowDays', t('settings.refundWindow'), t('common.appliesImmediately'), t('common.days'))}
            {numRow('payments', 'payoutMinUsd', t('settings.payoutMin'), t('common.appliesImmediately'), 'USD')}
            {numRow('payments', 'trialDays', t('settings.trialDays'), t('common.appliesImmediately'), t('common.days'))}
            {numRow('payments', 'subscriptionPeriodDays', t('settings.subscriptionPeriod'), t('common.appliesImmediately'), t('common.days'))}
            <SettingRow label={t('common.currency')} hint={t('common.storedOnly')}>
              <Segment
                label={t('common.currency')}
                value={draft.payments.currency}
                onChange={(v) => setG('payments', { currency: v })}
                options={[
                  { value: 'USD', label: 'USD' },
                  { value: 'VND', label: 'VND' },
                  { value: 'EUR', label: 'EUR' },
                ]}
              />
            </SettingRow>
            <SettingRow label={t('settings.autoPayouts')} hint={t('settings.autoPayoutsHint')}>
              <Toggle on={draft.payments.autoPayouts} label={t('settings.autoPayouts')} onChange={(v) => setG('payments', { autoPayouts: v })} />
            </SettingRow>
          </Card>
          {draft.referral && (
            <Card title={t('settings.referralTitle')} sub={t('settings.referralSub')}>
              {refRow('creatorRateBps', t('settings.refCreatorRate'), t('settings.refCreatorRateHint'), 'bps')}
              {refRow('memberRateBps', t('settings.refMemberRate'), t('settings.refMemberRateHint'), 'bps')}
              {refRow('attributionDays', t('settings.refAttributionDays'), t('common.appliesImmediately'), t('common.days'))}
              {refRow('payoutDay', t('settings.refPayoutDay'), t('settings.refPayoutDayHint'), t('settings.refDayOfMonth'))}
            </Card>
          )}
          {orig?.updatedAt && <p className="m-0 text-xs text-stone-400">{t('settings.lastUpdated', { date: formatDateTime(orig.updatedAt) })}</p>}
          <div className="flex">
            <AdminButton kind="danger" icon="restart_alt" onClick={() => resetKeys([], t('settings.allSettings'))}>
              {t('settings.resetAll')}
            </AdminButton>
          </div>
        </>
      )}
      {slot.el}
    </>
  );
}

import { useEffect, useState } from 'react';
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
      title={flag ? `Sửa tính năng · ${flag.name}` : 'Thêm tính năng thử nghiệm'}
      body={flag ? undefined : 'Tính năng mới mặc định đang tắt. Bạn có thể bật sau trong danh sách.'}
      cta={flag ? 'Lưu' : 'Thêm tính năng'}
      disabledExtra={!name.trim() || !rolloutOk || (!flag && !/^[a-z0-9_]+$/.test(key))}
      successMessage={flag ? 'Đã cập nhật tính năng' : 'Đã thêm tính năng'}
      run={() =>
        flag
          ? act.mutateAsync({ method: 'PATCH', path: `/system/flags/${flag.key}`, body: { name: name.trim(), description: desc.trim(), stage, rolloutPercent: r } })
          : act.mutateAsync({ path: '/system/flags', body: { key, name: name.trim(), description: desc.trim() || undefined, stage, rolloutPercent: r } })
      }
      onClose={onClose}
    >
      {!flag && <InputField label="Khóa (a-z, 0-9, _)" value={key} onChange={(v) => setKey(v.toLowerCase())} placeholder="vd. dm_v2" mono maxLength={60} />}
      <InputField label="Tên hiển thị" value={name} onChange={setName} maxLength={80} />
      <TextAreaField label="Mô tả" value={desc} onChange={setDesc} maxLength={300} />
      <OptionChips label="Giai đoạn triển khai" options={STAGE_OPTS} value={stage} onChange={(v) => setStage(v as string)} />
      <InputField label="Tỷ lệ triển khai (0-100%)" value={rollout} onChange={(v) => setRollout(v.replace(/\D/g, '').slice(0, 3))} />
    </ActionDialog>
  );
}

export function FlagsView() {
  const t = useTableState({ stage: '' });
  const slot = useDialogSlot();
  const toast = useToast();
  const act = useAdminAction();
  const [busy, setBusy] = useState<string | null>(null);
  const q = useAdminData<FeatureFlag[]>('system', '/system/flags', { q: t.q || undefined, stage: t.f.stage || undefined });

  const toggle = async (f: FeatureFlag, enabled: boolean) => {
    setBusy(f.key);
    try {
      await act.mutateAsync({ path: `/system/flags/${f.key}/toggle`, body: { enabled } });
      toast.success(`${enabled ? 'Đã bật' : 'Đã tắt'} "${f.name}"`);
    } catch (e) {
      toast.error(errMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const columns: Column<FeatureFlag>[] = [
    { key: 'f', label: 'Tính năng', w: 1.8, render: (f) => <MainCell name={f.name} sub={f.key} icon="flag" /> },
    { key: 'd', label: 'Mô tả', w: 2, render: (f) => <TextCell>{f.description || '—'}</TextCell> },
    {
      key: 'r',
      label: 'Triển khai',
      render: (f) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <StatusBadge tone={FLAG_STAGE[f.stage]?.tone ?? 'x'}>{FLAG_STAGE[f.stage]?.label ?? f.stage}</StatusBadge>
          {f.rolloutPercent < 100 && <span className="text-xs text-stone-500">{f.rolloutPercent}%</span>}
        </span>
      ),
    },
    { key: 'u', label: 'Cập nhật', render: (f) => <MutedCell>{formatRelative(f.updatedAt)}</MutedCell> },
    { key: 'on', label: 'Bật', w: 0.6, render: (f) => <Toggle on={f.enabled} disabled={busy === f.key} label={`Bật/tắt ${f.name}`} onChange={(v) => void toggle(f, v)} /> },
  ];

  const actions = (f: FeatureFlag): RowAction[] => [
    { label: 'Sửa', icon: 'edit', onClick: () => slot.show((close) => <FlagFormDialog flag={f} onClose={close} />) },
    {
      label: 'Xóa',
      icon: 'delete',
      danger: true,
      onClick: () =>
        slot.show((close) => (
          <ActionDialog icon="delete" danger title={`Xóa tính năng · ${f.name}`} body="Cờ này sẽ biến mất khỏi hệ thống; mã nguồn đang đọc cờ sẽ coi như tắt." cta="Xóa" successMessage="Đã xóa tính năng" run={() => act.mutateAsync({ method: 'DELETE', path: `/system/flags/${f.key}` })} onClose={close} />
        )),
    },
  ];

  return (
    <>
      <PageHeader
        title="Tính năng thử nghiệm"
        subtitle="Bật hoặc tắt tính năng trên toàn nền tảng."
        actions={
          <AdminButton kind="primary" icon="add" onClick={() => slot.show((close) => <FlagFormDialog onClose={close} />)}>
            Thêm tính năng
          </AdminButton>
        }
      />
      <DataTable<FeatureFlag>
        columns={columns}
        rows={q.data ?? []}
        rowKey={(f) => f.key}
        actions={actions}
        search={{ value: t.q, onChange: t.onQ, placeholder: 'Tìm tính năng...' }}
        filters={[{ key: 'stage', label: 'Giai đoạn', value: t.f.stage, options: STAGE_OPTS, onChange: t.setFilter('stage') }]}
        onClearFilters={t.clear}
        loading={q.isPending}
        error={q.isError ? q.error : null}
        onRetry={() => void q.refetch()}
        emptyText="Chưa có tính năng nào."
      />
      {slot.el}
    </>
  );
}

/* ============================== Tích hợp ============================== */

const INT_DESC: Record<string, string> = {
  stripe: 'Thanh toán thẻ và gói đăng ký.',
  paypal: 'Thanh toán và chi trả quốc tế.',
  momo: 'Ví điện tử tại Việt Nam.',
  zoom: 'Phòng họp cho sự kiện cộng đồng.',
  google_analytics: 'Theo dõi lưu lượng và chuyển đổi.',
  mailgun: 'Email giao dịch và thông báo.',
  slack: 'Gửi cảnh báo kiểm duyệt vào kênh nội bộ.',
  cloudflare: 'CDN và chống DDoS cho media.',
};

function ConnectDialog({ it, onClose }: { it: Integration; onClose: () => void }) {
  const act = useAdminAction();
  const [key, setKey] = useState('');
  return (
    <ActionDialog
      icon="link"
      title={`Kết nối ${it.name}`}
      body="Khóa bí mật thật vẫn nằm ở biến môi trường của máy chủ; ở đây chỉ lưu 4 ký tự cuối để hiển thị."
      cta="Kết nối"
      successMessage={`Đã kết nối ${it.name}`}
      run={() => act.mutateAsync({ path: `/system/integrations/${it.key}/connect`, body: { apiKey: key.trim() || undefined } })}
      onClose={onClose}
    >
      <InputField label="Khóa API (tùy chọn)" value={key} onChange={setKey} placeholder="sk_live_…" mono />
    </ActionDialog>
  );
}

function IntegrationCard({ it, onConnect, onDisconnect, onTest, testing }: { it: Integration; onConnect: () => void; onDisconnect: () => void; onTest: () => void; testing: boolean }) {
  return (
    <div className="flex flex-col gap-3 rounded-[18px] border border-[#f1ebe6] bg-white p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-[42px] flex-none place-items-center rounded-xl text-[13px] font-extrabold text-white" style={{ background: it.color }}>
          {it.initials}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-bold">{it.name}</div>
          <div className={`mt-0.5 text-[12.5px] font-semibold ${it.connected ? 'text-[#15803d]' : 'text-stone-400'}`}>{it.connected ? 'Đã kết nối' : 'Chưa kết nối'}</div>
        </div>
        <span className="rounded-full bg-[#f5f1ed] px-2 py-0.5 text-[11px] font-semibold text-stone-500">{INTEGRATION_CATEGORY[it.category] ?? it.category}</span>
      </div>
      <p className="m-0 text-[13px] leading-relaxed text-stone-500">{INT_DESC[it.key] ?? it.description}</p>
      {it.connected && (
        <div className="text-xs text-stone-400">
          {it.secretMask && <span>Khóa {it.secretMask} · </span>}
          {it.connectedAt && <span>kết nối {formatRelative(it.connectedAt)}</span>}
        </div>
      )}
      <div className="mt-auto flex gap-2">
        {it.connected ? (
          <>
            <AdminButton className="flex-1" onClick={onDisconnect}>
              Ngắt kết nối
            </AdminButton>
            <AdminButton icon="network_check" disabled={testing} onClick={onTest}>
              {testing ? 'Đang thử…' : 'Kiểm tra'}
            </AdminButton>
          </>
        ) : (
          <AdminButton kind="primary" className="flex-1" onClick={onConnect}>
            Kết nối
          </AdminButton>
        )}
      </div>
    </div>
  );
}

export function IntegrationsView() {
  const q = useAdminData<Integration[]>('system', '/system/integrations');
  const slot = useDialogSlot();
  const toast = useToast();
  const act = useAdminAction();
  const [testing, setTesting] = useState<string | null>(null);

  const test = async (it: Integration) => {
    setTesting(it.key);
    try {
      const r = (await act.mutateAsync({ path: `/system/integrations/${it.key}/test`, body: {} })) as { ok: boolean; message: string; latencyMs: number } | undefined;
      if (r?.ok) toast.success(`${it.name}: kết nối ổn${r.latencyMs != null ? ` (${r.latencyMs} ms)` : ''}`);
      else toast.error(`${it.name}: ${r?.message ?? 'kiểm tra thất bại'}`);
    } catch (e) {
      toast.error(errMessage(e));
    } finally {
      setTesting(null);
    }
  };

  return (
    <>
      <PageHeader title="Tích hợp" subtitle="Dịch vụ bên thứ ba kết nối với SofinHub." />
      <Card title="Dịch vụ đã kết nối">
        {q.isPending && <LoadingBlock />}
        {q.isError && <ErrorBlock error={q.error} onRetry={() => void q.refetch()} />}
        {q.data && q.data.length === 0 && <EmptyBlock>Chưa có dịch vụ nào.</EmptyBlock>}
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
                    <ActionDialog icon="link_off" danger title={`Ngắt kết nối ${it.name}?`} body="Các tính năng phụ thuộc dịch vụ này có thể ngừng hoạt động." cta="Ngắt kết nối" successMessage={`Đã ngắt kết nối ${it.name}`} run={() => act.mutateAsync({ path: `/system/integrations/${it.key}/disconnect`, body: {} })} onClose={close} />
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

const AUDIENCES = [
  { value: 'all', label: 'Mọi người dùng' },
  { value: 'creators', label: 'Creator' },
  { value: 'paid_members', label: 'Thành viên trả phí' },
  { value: 'community', label: 'Một cộng đồng' },
];
const audLabel = (a: BroadcastAudience) => AUDIENCES.find((x) => x.value === a.type)?.label ?? a.type;

function BroadcastCard() {
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
        title="Gửi thông báo hệ thống?"
        body={`Gửi "${title.trim()}" tới ${audLabel(audience).toLowerCase()}. Thao tác này không thu hồi được.`}
        cta="Gửi thông báo"
        successMessage="Đã gửi thông báo"
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
      toast.success(`Thông báo sẽ tới ${(r?.recipientCount ?? 0).toLocaleString('vi-VN')} người`);
    } catch (e) {
      toast.error(errMessage(e));
    }
  };

  return (
    <Card title="Thông báo tới người dùng" sub="Gửi thông báo trong ứng dụng (và email nếu chọn) tới một nhóm người dùng.">
      <InputField label="Tiêu đề" value={title} onChange={setTitle} maxLength={120} />
      <TextAreaField label="Nội dung" value={body} onChange={setBody} maxLength={1000} />
      <InputField label="Liên kết (tùy chọn)" value={link} onChange={setLink} placeholder="/communities/…" />
      <OptionChips label="Đối tượng nhận" options={AUDIENCES} value={type} onChange={(v) => setType(v as string)} />
      {type === 'community' && <InputField label="Mã cộng đồng" value={courseId} onChange={setCourseId} placeholder="vd. photo" />}
      <label className="flex items-center gap-2 text-[13.5px]">
        <Toggle on={email} onChange={setEmail} label="Gửi kèm email" />
        Gửi kèm email
      </label>
      <div className="flex flex-wrap gap-2">
        <AdminButton icon="groups" disabled={!ready && type === 'community' && !courseId.trim()} onClick={() => void preview()}>
          Xem số người nhận
        </AdminButton>
        <AdminButton kind="primary" icon="campaign" disabled={!ready} onClick={send}>
          Gửi thông báo
        </AdminButton>
      </div>
      {slot.el}
    </Card>
  );
}

function BroadcastHistory() {
  const t = useTableState({});
  const list = useAdminList<Broadcast>('system', '/system/notifications/broadcasts', { page: t.page, limit: 10 });
  return (
    <DataTable<Broadcast>
      title="Lịch sử thông báo đã gửi"
      columns={[
        { key: 't', label: 'Thông báo', w: 2, render: (b) => <MainCell name={b.title} sub={b.body} icon="campaign" /> },
        { key: 'a', label: 'Đối tượng', render: (b) => <TextCell>{audLabel(b.audience)}</TextCell> },
        { key: 'r', label: 'Người nhận', render: (b) => <TextCell>{b.recipientCount.toLocaleString('vi-VN')}</TextCell> },
        { key: 'e', label: 'Email', w: 0.7, render: (b) => <TextCell>{b.emailCount.toLocaleString('vi-VN')}</TextCell> },
        { key: 's', label: 'Người gửi', render: (b) => <TextCell>{b.sentBy.name}</TextCell> },
        { key: 'c', label: 'Thời gian', render: (b) => <MutedCell>{formatDateTime(b.createdAt)}</MutedCell> },
      ]}
      rows={list.data?.data ?? []}
      rowKey={(b) => b.id}
      loading={list.isPending}
      error={list.isError ? list.error : null}
      onRetry={() => void list.refetch()}
      emptyText="Chưa gửi thông báo nào."
      page={list.data ? { page: list.data.meta.page, totalPages: list.data.meta.totalPages, total: list.data.meta.total, limit: 10, onPage: t.setPage } : undefined}
    />
  );
}

export function NotificationsView() {
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
      toast.success('Đã lưu cấu hình thông báo');
    } catch (e) {
      toast.error(errMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Thông báo"
        subtitle="Cảnh báo gửi cho các nhóm quản trị và thông báo tới người dùng."
        actions={
          <>
            {dirty && (
              <AdminButton onClick={() => q.data && setDraft(q.data)} disabled={saving}>
                Hoàn tác
              </AdminButton>
            )}
            <AdminButton kind="primary" icon="save" disabled={!dirty || saving} onClick={() => void save()}>
              {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
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
              title="Cảnh báo kiểm duyệt"
              sub="Gửi cho nhóm kiểm duyệt."
              group="moderation"
              value={draft}
              onChange={setDraft}
              rows={[
                { key: 'criticalReports', label: 'Báo cáo nghiêm trọng', hint: 'Email + thông báo đẩy' },
                { key: 'pendingCommunities', label: 'Cộng đồng chờ duyệt' },
                { key: 'aiFlagged', label: 'Nội dung bị AI gắn cờ' },
              ]}
            />
            <AlertForm
              title="Cảnh báo thanh toán"
              sub="Gửi cho nhóm tài chính."
              group="payments"
              value={draft}
              onChange={setDraft}
              rows={[
                { key: 'newChargeback', label: 'Tranh chấp mới' },
                { key: 'failedPayout', label: 'Chi trả thất bại' },
                { key: 'refundOver500', label: 'Hoàn tiền trên $500' },
              ]}
            />
          </div>
          <AlertForm
            title="Báo cáo"
            sub="Báo cáo định kỳ qua email."
            group="reports"
            value={draft}
            onChange={setDraft}
            rows={[
              { key: 'weeklySummary', label: 'Tổng kết hằng tuần' },
              { key: 'monthlyBoardReport', label: 'Báo cáo hằng tháng' },
            ]}
          >
            <SettingRow label="Gửi đến" hint="Email nhận báo cáo định kỳ">
              <SettingInput label="Email nhận báo cáo" value={draft.reports.sendTo} onChange={(v) => setDraft({ ...draft, reports: { ...draft.reports, sendTo: v } })} placeholder="ops@sofinhub.com" />
            </SettingRow>
          </AlertForm>
          <p className="m-0 text-xs text-stone-400">Hiện hệ thống chỉ lưu cấu hình; chưa có tác vụ tự động gửi các cảnh báo/báo cáo định kỳ này.</p>
        </>
      )}
      <BroadcastCard />
      <BroadcastHistory />
    </>
  );
}

/* ============================== Cài đặt chung ============================== */

type GroupKey = 'platform' | 'payments' | 'security';

const OVERRIDE_KEYS: Record<string, string> = {
  commissionPct: 'payments.commissionPct',
  gatewayFeePct: 'payments.gatewayFeePct',
  gatewayFeeFixedCents: 'payments.gatewayFeeFixedCents',
  refundWindowDays: 'payments.refundWindowDays',
  payoutMinUsd: 'payments.payoutMinUsd',
  trialDays: 'payments.trialDays',
  subscriptionPeriodDays: 'payments.subscriptionPeriodDays',
};

export function SettingsView() {
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
  const dirty = !!draft && !!orig && (['platform', 'payments', 'security'] as GroupKey[]).some((g) => JSON.stringify(draft[g]) !== JSON.stringify(orig[g]));

  const setG = <G extends GroupKey>(g: G, patch: Partial<PlatformSettings[G]>) => draft && setDraft({ ...draft, [g]: { ...draft[g], ...patch } });
  const num = (v: string) => (v.trim() === '' ? NaN : Number(v.replace(',', '.')));

  const validate = (): string | null => {
    if (!draft) return null;
    const p = draft.payments;
    const checks: [number, number, number, string][] = [
      [p.commissionPct, 0, 100, 'Hoa hồng nền tảng (0–100%)'],
      [p.gatewayFeePct, 0, 100, 'Phí cổng thanh toán (0–100%)'],
      [p.refundWindowDays, 0, 365, 'Thời hạn hoàn tiền (0–365 ngày)'],
      [p.payoutMinUsd, 0, 100000, 'Mức rút tối thiểu'],
      [p.trialDays, 0, 365, 'Số ngày dùng thử (0–365)'],
      [p.subscriptionPeriodDays, 1, 365, 'Chu kỳ gói đăng ký (1–365 ngày)'],
      [p.gatewayFeeFixedCents, 0, 100000, 'Phí cố định cổng thanh toán'],
    ];
    for (const [v, lo, hi, label] of checks) if (!Number.isFinite(v) || v < lo || v > hi) return `${label} không hợp lệ.`;
    if (!draft.platform.name.trim()) return 'Tên nền tảng không được để trống.';
    if (!/^\S+@\S+\.\S+$/.test(draft.platform.supportEmail.trim())) return 'Email hỗ trợ không hợp lệ.';
    return null;
  };
  const problem = validate();

  const save = async () => {
    if (!draft || !orig) return;
    const patch: Record<string, unknown> = {};
    (['platform', 'payments', 'security'] as GroupKey[]).forEach((g) => {
      const changed = Object.fromEntries(Object.entries(draft[g]).filter(([k, v]) => v !== (orig[g] as unknown as Record<string, unknown>)[k]));
      if (Object.keys(changed).length > 0) patch[g] = changed;
    });
    setSaving(true);
    try {
      await act.mutateAsync({ method: 'PATCH', path: '/system/settings', body: patch });
      toast.success('Đã lưu cài đặt chung');
    } catch (e) {
      toast.error(errMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const resetKeys = (keys: string[], label: string) =>
    slot.show((close) => (
      <ActionDialog icon="restart_alt" title={`Khôi phục mặc định · ${label}`} body="Giá trị sẽ quay về mặc định của máy chủ (biến môi trường)." cta="Khôi phục" successMessage="Đã khôi phục giá trị mặc định" run={() => act.mutateAsync({ path: '/system/settings/reset', body: { keys } })} onClose={close} />
    ));

  const onMaintenance = (v: boolean) => {
    if (!v) return setG('security', { maintenanceMode: false });
    slot.show((close) => (
      <ActionDialog
        icon="construction"
        danger
        title="Bật chế độ bảo trì?"
        body="Mọi API công khai sẽ trả lỗi 503 và thành viên thấy trang bảo trì cho tới khi bạn tắt. Khu vực quản trị và đăng nhập vẫn hoạt động. Thay đổi có hiệu lực sau khi bấm Lưu."
        cta="Bật khi lưu"
        successMessage="Đã đặt chế độ bảo trì (nhớ bấm Lưu thay đổi)"
        run={async () => setG('security', { maintenanceMode: true })}
        onClose={close}
      />
    ));
  };

  const over = (field: string) => {
    const o = orig?.overrides[OVERRIDE_KEYS[field] ?? ''];
    return o?.overridden ? (
      <button type="button" className="ml-3 border-0 bg-transparent p-0 text-xs font-semibold text-brand hover:underline" onClick={() => resetKeys([OVERRIDE_KEYS[field]!], field)}>
        Mặc định: {String(o.default)} · Khôi phục
      </button>
    ) : null;
  };
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
        title="Cài đặt chung"
        subtitle="Cấu hình toàn nền tảng."
        actions={
          <>
            {dirty && (
              <AdminButton disabled={saving} onClick={() => orig && setDraft(orig)}>
                Hoàn tác
              </AdminButton>
            )}
            <AdminButton kind="primary" icon="save" disabled={!dirty || saving || !!problem} onClick={() => void save()}>
              {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
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
            <Card title="Nền tảng" sub="Tên, liên hệ và thiết lập mặc định.">
              <SettingRow label="Tên nền tảng">
                <SettingInput label="Tên nền tảng" value={draft.platform.name} onChange={(v) => setG('platform', { name: v })} />
              </SettingRow>
              <SettingRow label="Email hỗ trợ">
                <SettingInput label="Email hỗ trợ" value={draft.platform.supportEmail} onChange={(v) => setG('platform', { supportEmail: v })} />
              </SettingRow>
              <SettingRow label="Ngôn ngữ mặc định">
                <Segment
                  label="Ngôn ngữ mặc định"
                  value={draft.platform.defaultLanguage}
                  onChange={(v) => setG('platform', { defaultLanguage: v })}
                  options={[
                    { value: 'en', label: 'Tiếng Anh' },
                    { value: 'vi', label: 'Tiếng Việt' },
                  ]}
                />
              </SettingRow>
              <SettingRow label="Múi giờ" hint="Chỉ lưu cấu hình">
                <SettingInput label="Múi giờ" value={draft.platform.timezone} onChange={(v) => setG('platform', { timezone: v })} />
              </SettingRow>
            </Card>
            <Card title="Bảo mật" sub="Chính sách cho tài khoản quản trị.">
              <SettingRow label="Bắt buộc 2FA cho quản trị viên" hint="Chỉ lưu cấu hình (chưa có cơ chế thực thi)">
                <Toggle on={draft.security.require2fa} label="Bắt buộc 2FA" onChange={(v) => setG('security', { require2fa: v })} />
              </SettingRow>
              <SettingRow label="Tự đăng xuất sau" hint="Chỉ lưu cấu hình">
                <Segment
                  label="Tự đăng xuất sau"
                  value={String(draft.security.sessionTimeoutMin)}
                  onChange={(v) => setG('security', { sessionTimeoutMin: Number(v) })}
                  options={[
                    { value: '15', label: '15 phút' },
                    { value: '30', label: '30 phút' },
                    { value: '120', label: '2 giờ' },
                  ]}
                />
              </SettingRow>
              <SettingRow label="Chế độ bảo trì" hint="Thành viên sẽ thấy trang bảo trì">
                <Toggle on={draft.security.maintenanceMode} label="Chế độ bảo trì" onChange={onMaintenance} />
              </SettingRow>
            </Card>
          </div>
          <Card title="Thanh toán" sub="Phí, thời hạn và lịch chi trả. Các mục có nhãn “áp dụng ngay” ảnh hưởng thanh toán/hoàn tiền/rút tiền mới.">
            {numRow('payments', 'commissionPct', 'Hoa hồng nền tảng', 'Áp dụng ngay cho thanh toán mới', '%')}
            {numRow('payments', 'gatewayFeePct', 'Phí cổng thanh toán (%)', 'Áp dụng ngay', '%')}
            {numRow('payments', 'gatewayFeeFixedCents', 'Phí cổng cố định', 'Áp dụng ngay · đơn vị cent', 'cent')}
            {numRow('payments', 'refundWindowDays', 'Thời hạn hoàn tiền', 'Áp dụng ngay', 'ngày')}
            {numRow('payments', 'payoutMinUsd', 'Mức rút tối thiểu', 'Áp dụng ngay', 'USD')}
            {numRow('payments', 'trialDays', 'Số ngày dùng thử', 'Áp dụng ngay', 'ngày')}
            {numRow('payments', 'subscriptionPeriodDays', 'Chu kỳ gói đăng ký', 'Áp dụng ngay', 'ngày')}
            <SettingRow label="Tiền tệ" hint="Chỉ lưu cấu hình">
              <Segment
                label="Tiền tệ"
                value={draft.payments.currency}
                onChange={(v) => setG('payments', { currency: v })}
                options={[
                  { value: 'USD', label: 'USD' },
                  { value: 'VND', label: 'VND' },
                  { value: 'EUR', label: 'EUR' },
                ]}
              />
            </SettingRow>
            <SettingRow label="Chi trả tự động" hint="Chỉ lưu cấu hình · ngày 1 và 16 hàng tháng">
              <Toggle on={draft.payments.autoPayouts} label="Chi trả tự động" onChange={(v) => setG('payments', { autoPayouts: v })} />
            </SettingRow>
          </Card>
          {orig?.updatedAt && <p className="m-0 text-xs text-stone-400">Cập nhật lần cuối {formatDateTime(orig.updatedAt)}.</p>}
          <div className="flex">
            <AdminButton kind="danger" icon="restart_alt" onClick={() => resetKeys([], 'toàn bộ cài đặt')}>
              Khôi phục toàn bộ về mặc định
            </AdminButton>
          </div>
        </>
      )}
      {slot.el}
    </>
  );
}

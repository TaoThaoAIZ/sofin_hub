import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDateTime } from '../../../lib/datetime';
import { ActionDialog, PreviewDialog, PreviewKv, useDialogSlot, useTableState } from '../components/Batch2Parts';
import { PermissionMatrix, type MatrixPermission, type MatrixRole } from '../components/Batch3Parts';
import { DataTable, MainCell, MutedCell, type Column, type RowAction } from '../components/DataTable';
import { CheckField, InputField, OptionChips, TextAreaField, useToast } from '../components/overlay';
import { PageHeader } from '../components/PageHeader';
import { AdminButton, Card, CARD_CLS, ErrorBlock, LoadingBlock, StatusBadge, errMessage } from '../components/ui';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { useAdminAction, useAdminData, useAdminList } from '../queries.batch2';
import { PERMISSION_LABEL, ROLE_LABEL, type AdminAccount, type RoleDef, type RolesData } from '../types.batch3';

const LIMIT = 20;
const roleName = (key: string, fallback: string) => ROLE_LABEL[key] ?? fallback;

/* ============================== Tài khoản quản trị ============================== */

function CreateAdminDialog({ roles, onClose }: { roles: RoleDef[]; onClose: () => void }) {
  const { t } = useTranslation('admin-pages2');
  const act = useAdminAction();
  const [email, setEmail] = useState('');
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [roleKey, setRoleKey] = useState('moderator');
  const [tfa, setTfa] = useState(true);
  return (
    <ActionDialog
      icon="person_add"
      title={t('access.admins.create.title')}
      body={t('access.admins.create.body')}
      cta={t('access.admins.create.cta')}
      disabledExtra={!/^\S+@\S+\.\S+$/.test(email.trim()) || !roleKey}
      successMessage={t('access.admins.create.success')}
      run={() =>
        act.mutateAsync({
          path: '/system/admins',
          body: { email: email.trim(), roleKey, firstName: first.trim() || undefined, lastName: last.trim() || undefined, twoFactorEnabled: tfa },
        })
      }
      onClose={onClose}
    >
      <InputField label={t('access.admins.create.email')} value={email} onChange={setEmail} placeholder="name@sofinhub.com" />
      <div className="grid grid-cols-2 gap-3">
        <InputField label={t('access.admins.create.firstName')} value={first} onChange={setFirst} maxLength={60} />
        <InputField label={t('access.admins.create.lastName')} value={last} onChange={setLast} maxLength={60} />
      </div>
      <OptionChips label={t('access.role')} options={roles.map((r) => ({ value: r.key, label: roleName(r.key, r.name) }))} value={roleKey} onChange={(v) => setRoleKey(v as string)} />
      <CheckField text={t('access.admins.create.require2fa')} checked={tfa} onChange={setTfa} />
    </ActionDialog>
  );
}

function EditRoleDialog({ admin, roles, onClose }: { admin: AdminAccount; roles: RoleDef[]; onClose: () => void }) {
  const { t } = useTranslation('admin-pages2');
  const act = useAdminAction();
  const [roleKey, setRoleKey] = useState(admin.role.key);
  return (
    <ActionDialog
      icon="manage_accounts"
      title={t('access.admins.editRole.title', { name: admin.name })}
      cta={t('access.admins.editRole.cta')}
      disabledExtra={roleKey === admin.role.key}
      successMessage={t('access.admins.editRole.success', { name: admin.name })}
      run={() => act.mutateAsync({ method: 'PATCH', path: `/system/admins/${admin.id}`, body: { roleKey } })}
      onClose={onClose}
    >
      <OptionChips label={t('access.role')} options={roles.map((r) => ({ value: r.key, label: roleName(r.key, r.name) }))} value={roleKey} onChange={(v) => setRoleKey(v as string)} />
    </ActionDialog>
  );
}

export function AdminAccountsView() {
  const { t } = useTranslation('admin-pages2');
  const ts = useTableState({ role: '', status: '' });
  const slot = useDialogSlot();
  const toast = useToast();
  const act = useAdminAction();
  const roles = useAdminData<RolesData>('system', '/system/roles');
  const list = useAdminList<AdminAccount>('system', '/system/admins', { q: ts.q || undefined, role: ts.f.role || undefined, status: ts.f.status || undefined, page: ts.page, limit: LIMIT });
  const roleList = roles.data?.roles ?? [];

  const quick = (a: AdminAccount, path: string, ok: string, method?: 'POST' | 'DELETE') =>
    act.mutateAsync({ method, path: `/system/admins/${a.id}${path}`, body: {} }).then(
      () => toast.success(ok),
      (e) => toast.error(errMessage(e)),
    );

  const columns: Column<AdminAccount>[] = [
    { key: 'admin', label: t('access.admins.col.admin'), w: 1.8, render: (a) => <MainCell name={a.name} sub={a.email} avatar avatarSrc={a.avatarUrl} seed={a.id} /> },
    { key: 'role', label: t('access.role'), render: (a) => <StatusBadge tone={a.role.key === 'super_admin' ? 'o' : 'b'}>{roleName(a.role.key, a.role.name)}</StatusBadge> },
    { key: 'tfa', label: '2FA', w: 0.6, render: (a) => <MaterialIcon name={a.twoFactorEnabled ? 'check_circle' : 'cancel'} size={20} filled color={a.twoFactorEnabled ? '#16a34a' : '#d6d3d1'} /> },
    { key: 'last', label: t('access.admins.lastLogin'), render: (a) => <MutedCell>{a.lastLoginAt ? formatDateTime(a.lastLoginAt) : t('access.admins.neverLoggedIn')}</MutedCell> },
    { key: 'st', label: t('access.admins.status'), w: 0.8, render: (a) => <StatusBadge tone={a.status === 'active' ? 'g' : 'r'}>{a.status === 'active' ? t('access.admins.active') : t('access.admins.suspended')}</StatusBadge> },
  ];

  const actions = (a: AdminAccount): RowAction[] => {
    const lockedNote = a.locked;
    return [
      { label: t('access.admins.action.changeRole'), icon: 'manage_accounts', disabled: lockedNote, onClick: () => slot.show((close) => <EditRoleDialog admin={a} roles={roleList} onClose={close} />) },
      {
        label: t('access.admins.action.reset2fa'),
        icon: 'phonelink_lock',
        onClick: () =>
          slot.show((close) => (
            <ActionDialog icon="phonelink_lock" title={t('access.admins.reset2fa.title', { name: a.name })} body={t('access.admins.reset2fa.body')} cta={t('access.admins.action.reset2fa')} successMessage={t('access.admins.reset2fa.success', { name: a.name })} run={() => act.mutateAsync({ path: `/system/admins/${a.id}/reset-2fa`, body: {} })} onClose={close} />
          )),
      },
      a.status === 'suspended'
        ? { label: t('access.admins.action.reactivate'), icon: 'check_circle', disabled: lockedNote, onClick: () => void quick(a, '/enable', t('access.admins.reactivated', { name: a.name }), 'POST') }
        : {
            label: t('access.admins.suspended'),
            icon: 'block',
            danger: true,
            disabled: lockedNote,
            onClick: () =>
              slot.show((close) => (
                <ActionDialog icon="block" danger title={t('access.admins.suspend.title', { name: a.name })} body={t('access.admins.suspend.body')} cta={t('access.admins.suspended')} noteLabel={t('access.admins.suspend.reason')} successMessage={t('access.admins.suspend.success', { name: a.name })} run={(v) => act.mutateAsync({ path: `/system/admins/${a.id}/suspend`, body: { reason: v.note || undefined } })} onClose={close} />
              )),
          },
      {
        label: t('access.admins.action.revoke'),
        icon: 'person_remove',
        danger: true,
        disabled: lockedNote,
        onClick: () =>
          slot.show((close) => (
            <ActionDialog icon="person_remove" danger title={t('access.admins.revoke.title', { name: a.name })} body={t('access.admins.revoke.body')} cta={t('access.admins.revoke.cta')} successMessage={t('access.admins.revoke.success', { name: a.name })} run={() => act.mutateAsync({ method: 'DELETE', path: `/system/admins/${a.id}` })} onClose={close} />
          )),
      },
    ];
  };

  return (
    <>
      <PageHeader
        title={t('access.admins.title')}
        subtitle={t('access.admins.subtitle')}
        actions={
          <AdminButton kind="primary" icon="person_add" disabled={roles.isPending || roles.isError} onClick={() => slot.show((close) => <CreateAdminDialog roles={roleList} onClose={close} />)}>
            {t('access.admins.create.title')}
          </AdminButton>
        }
      />
      <DataTable<AdminAccount>
        columns={columns}
        rows={list.data?.data ?? []}
        rowKey={(a) => a.id}
        onRow={(a) =>
          slot.show((close) => (
            <PreviewDialog title={a.name} sub={a.email} onClose={close}>
              <PreviewKv
                items={[
                  [t('access.role'), roleName(a.role.key, a.role.name)],
                  [t('access.admins.detail.source'), a.source === 'env' ? t('access.admins.detail.sourceEnv') : t('access.admins.detail.sourceStaff')],
                  ['2FA', a.twoFactorEnabled ? t('access.admins.detail.on') : t('access.admins.detail.off')],
                  [t('access.admins.lastLogin'), a.lastLoginAt ? formatDateTime(a.lastLoginAt) : t('access.admins.neverLoggedIn')],
                  [t('access.admins.detail.joined'), formatDateTime(a.createdAt)],
                  [t('access.admins.status'), a.status === 'active' ? t('access.admins.active') : t('access.admins.suspended')],
                ]}
              />
              {a.locked && <div className="rounded-xl bg-[#faf7f4] px-3.5 py-2.5 text-[13px] text-stone-500">{t('access.admins.detail.locked')}</div>}
            </PreviewDialog>
          ))
        }
        actions={actions}
        search={{ value: ts.q, onChange: ts.onQ, placeholder: t('access.admins.searchPlaceholder') }}
        filters={[
          { key: 'role', label: t('access.role'), value: ts.f.role, options: roleList.map((r) => ({ value: r.key, label: roleName(r.key, r.name) })), onChange: ts.setFilter('role') },
          {
            key: 'status',
            label: t('access.admins.status'),
            value: ts.f.status,
            options: [
              { value: 'active', label: t('access.admins.active') },
              { value: 'suspended', label: t('access.admins.suspended') },
            ],
            onChange: ts.setFilter('status'),
          },
        ]}
        onClearFilters={ts.clear}
        loading={list.isPending}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        emptyText={t('access.admins.empty')}
        page={list.data ? { page: list.data.meta.page, totalPages: list.data.meta.totalPages, total: list.data.meta.total, limit: LIMIT, onPage: ts.setPage } : undefined}
      />
      {slot.el}
    </>
  );
}

/* ============================== Vai trò & Quyền ============================== */

function CreateRoleDialog({ perms, onClose }: { perms: MatrixPermission[]; onClose: () => void }) {
  const { t } = useTranslation('admin-pages2');
  const act = useAdminAction();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [sel, setSel] = useState<string[]>(['dashboard.view']);
  return (
    <ActionDialog
      icon="add_moderator"
      title={t('access.roles.create.title')}
      body={t('access.roles.create.body')}
      cta={t('access.roles.create.title')}
      disabledExtra={!name.trim() || sel.length === 0}
      successMessage={t('access.roles.create.success')}
      run={() => act.mutateAsync({ path: '/system/roles', body: { name: name.trim(), description: desc.trim() || undefined, permissions: sel } })}
      onClose={onClose}
    >
      <InputField label={t('access.roles.name')} value={name} onChange={setName} maxLength={60} />
      <TextAreaField label={t('access.roles.descOptional')} value={desc} onChange={setDesc} maxLength={300} />
      <OptionChips multi label={t('access.roles.permissions')} options={perms.filter((p) => p.key !== 'admin.manage').map((p) => ({ value: p.key, label: p.label }))} value={sel} onChange={(v) => setSel(v as string[])} />
    </ActionDialog>
  );
}

function EditRoleInfoDialog({ role, onClose }: { role: RoleDef; onClose: () => void }) {
  const { t } = useTranslation('admin-pages2');
  const act = useAdminAction();
  const [name, setName] = useState(role.name);
  const [desc, setDesc] = useState(role.description ?? '');
  return (
    <ActionDialog
      icon="edit"
      title={t('access.roles.edit.title', { name: role.name })}
      cta={t('access.roles.save')}
      disabledExtra={!name.trim()}
      successMessage={t('access.roles.edit.success')}
      run={() => act.mutateAsync({ method: 'PATCH', path: `/system/roles/${role.key}`, body: { name: name.trim(), description: desc.trim() } })}
      onClose={onClose}
    >
      <InputField label={t('access.roles.name')} value={name} onChange={setName} maxLength={60} />
      <TextAreaField label={t('access.roles.desc')} value={desc} onChange={setDesc} maxLength={300} />
    </ActionDialog>
  );
}

export function RolesView() {
  const { t } = useTranslation('admin-pages2');
  const q = useAdminData<RolesData>('system', '/system/roles');
  const act = useAdminAction();
  const toast = useToast();
  const slot = useDialogSlot();
  const [busy, setBusy] = useState<string | null>(null);
  const data = q.data;

  const perms: MatrixPermission[] = (data?.permissions ?? []).map((p) => ({ key: p.key, label: PERMISSION_LABEL[p.key] ?? p.label, desc: p.group }));
  const roles: MatrixRole[] = (data?.roles ?? []).map((r) => ({ key: r.key, label: roleName(r.key, r.name), locked: r.locked }));
  const granted = new Set((data?.roles ?? []).flatMap((r) => r.permissions.map((p) => `${r.key}:${p}`)));

  const toggle = async (role: MatrixRole, perm: MatrixPermission, next: boolean) => {
    if (perm.key === 'admin.manage' && role.key !== 'super_admin') {
      toast.error(t('access.roles.adminManageOnlySuper'));
      return;
    }
    const id = `${role.key}:${perm.key}`;
    setBusy(id);
    try {
      await act.mutateAsync({ method: 'PATCH', path: `/system/roles/${role.key}`, body: { permission: perm.key, granted: next } });
      toast.success(next ? t('access.roles.granted', { perm: perm.label, role: role.label }) : t('access.roles.revoked', { perm: perm.label, role: role.label }));
    } catch (e) {
      toast.error(errMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader
        title={t('access.roles.title')}
        subtitle={t('access.roles.subtitle')}
        actions={
          <AdminButton kind="primary" icon="add" disabled={!data} onClick={() => slot.show((close) => <CreateRoleDialog perms={perms} onClose={close} />)}>
            {t('access.roles.create.title')}
          </AdminButton>
        }
      />
      <section className={`${CARD_CLS} overflow-hidden`}>
        {q.isPending && <LoadingBlock />}
        {q.isError && <ErrorBlock error={q.error} onRetry={() => void q.refetch()} />}
        {data && <PermissionMatrix roles={roles} permissions={perms} granted={granted} busyCell={busy} onToggle={(r, p, n) => void toggle(r, p, n)} />}
      </section>
      {data && (
        <Card title={t('access.role')} sub={t('access.roles.cardSub')}>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))' }}>
            {data.roles.map((r) => (
              <div key={r.key} className="flex flex-col gap-2 rounded-[14px] border border-[#f1ebe6] p-3.5">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">{roleName(r.key, r.name)}</span>
                  {r.locked && <MaterialIcon name="lock" size={16} color="#a8a29e" />}
                  {r.isSystem ? <StatusBadge tone="x">{t('access.roles.system')}</StatusBadge> : <StatusBadge tone="b">{t('access.roles.custom')}</StatusBadge>}
                </div>
                {r.description && <div className="text-xs leading-normal text-stone-500">{r.description}</div>}
                <div className="text-xs text-stone-400">
                  {t('access.roles.counts', { members: r.memberCount, perms: r.permissions.length })}
                </div>
                {!r.locked && (
                  <div className="mt-auto flex gap-1.5 pt-1">
                    <button type="button" className="h-[30px] rounded-[9px] border border-[#e7e0da] bg-white px-3 text-[12.5px] font-semibold hover:bg-[#fff4ec]" onClick={() => slot.show((close) => <EditRoleInfoDialog role={r} onClose={close} />)}>
                      {t('access.roles.edit.button')}
                    </button>
                    {!r.isSystem && (
                      <button
                        type="button"
                        disabled={r.memberCount > 0}
                        title={r.memberCount > 0 ? t('access.roles.inUse') : undefined}
                        className="h-[30px] rounded-[9px] border border-[#fecaca] bg-white px-3 text-[12.5px] font-semibold text-[#b91c1c] hover:bg-[#fef2f2] disabled:opacity-40"
                        onClick={() =>
                          slot.show((close) => (
                            <ActionDialog icon="delete" danger title={t('access.roles.delete.title', { name: r.name })} body={t('access.roles.delete.body')} cta={t('access.roles.delete.cta')} successMessage={t('access.roles.delete.success')} run={() => act.mutateAsync({ method: 'DELETE', path: `/system/roles/${r.key}` })} onClose={close} />
                          ))
                        }
                      >
                        {t('access.roles.delete.cta')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
      {slot.el}
    </>
  );
}

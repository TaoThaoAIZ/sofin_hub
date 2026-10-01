import { useState } from 'react';
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
  const act = useAdminAction();
  const [email, setEmail] = useState('');
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [roleKey, setRoleKey] = useState('moderator');
  const [tfa, setTfa] = useState(true);
  return (
    <ActionDialog
      icon="person_add"
      title="Tạo quản trị viên"
      body="Nếu email đã có tài khoản thì chỉ cấp vai trò. Nếu chưa có, hệ thống tạo tài khoản mời và gửi email đặt lại mật khẩu."
      cta="Gửi lời mời"
      disabledExtra={!/^\S+@\S+\.\S+$/.test(email.trim()) || !roleKey}
      successMessage="Đã gửi lời mời quản trị viên"
      run={() =>
        act.mutateAsync({
          path: '/system/admins',
          body: { email: email.trim(), roleKey, firstName: first.trim() || undefined, lastName: last.trim() || undefined, twoFactorEnabled: tfa },
        })
      }
      onClose={onClose}
    >
      <InputField label="Email công việc" value={email} onChange={setEmail} placeholder="name@sofinhub.com" />
      <div className="grid grid-cols-2 gap-3">
        <InputField label="Tên (nếu chưa có tài khoản)" value={first} onChange={setFirst} maxLength={60} />
        <InputField label="Họ" value={last} onChange={setLast} maxLength={60} />
      </div>
      <OptionChips label="Vai trò" options={roles.map((r) => ({ value: r.key, label: roleName(r.key, r.name) }))} value={roleKey} onChange={(v) => setRoleKey(v as string)} />
      <CheckField text="Bắt buộc 2FA ở lần đăng nhập đầu" checked={tfa} onChange={setTfa} />
    </ActionDialog>
  );
}

function EditRoleDialog({ admin, roles, onClose }: { admin: AdminAccount; roles: RoleDef[]; onClose: () => void }) {
  const act = useAdminAction();
  const [roleKey, setRoleKey] = useState(admin.role.key);
  return (
    <ActionDialog
      icon="manage_accounts"
      title={`Đổi vai trò · ${admin.name}`}
      cta="Lưu vai trò"
      disabledExtra={roleKey === admin.role.key}
      successMessage={`Đã cập nhật vai trò · ${admin.name}`}
      run={() => act.mutateAsync({ method: 'PATCH', path: `/system/admins/${admin.id}`, body: { roleKey } })}
      onClose={onClose}
    >
      <OptionChips label="Vai trò" options={roles.map((r) => ({ value: r.key, label: roleName(r.key, r.name) }))} value={roleKey} onChange={(v) => setRoleKey(v as string)} />
    </ActionDialog>
  );
}

export function AdminAccountsView() {
  const t = useTableState({ role: '', status: '' });
  const slot = useDialogSlot();
  const toast = useToast();
  const act = useAdminAction();
  const roles = useAdminData<RolesData>('system', '/system/roles');
  const list = useAdminList<AdminAccount>('system', '/system/admins', { q: t.q || undefined, role: t.f.role || undefined, status: t.f.status || undefined, page: t.page, limit: LIMIT });
  const roleList = roles.data?.roles ?? [];

  const quick = (a: AdminAccount, path: string, ok: string, method?: 'POST' | 'DELETE') =>
    act.mutateAsync({ method, path: `/system/admins/${a.id}${path}`, body: {} }).then(
      () => toast.success(ok),
      (e) => toast.error(errMessage(e)),
    );

  const columns: Column<AdminAccount>[] = [
    { key: 'admin', label: 'Quản trị viên', w: 1.8, render: (a) => <MainCell name={a.name} sub={a.email} avatar avatarSrc={a.avatarUrl} seed={a.id} /> },
    { key: 'role', label: 'Vai trò', render: (a) => <StatusBadge tone={a.role.key === 'super_admin' ? 'o' : 'b'}>{roleName(a.role.key, a.role.name)}</StatusBadge> },
    { key: 'tfa', label: '2FA', w: 0.6, render: (a) => <MaterialIcon name={a.twoFactorEnabled ? 'check_circle' : 'cancel'} size={20} filled color={a.twoFactorEnabled ? '#16a34a' : '#d6d3d1'} /> },
    { key: 'last', label: 'Đăng nhập gần nhất', render: (a) => <MutedCell>{a.lastLoginAt ? formatDateTime(a.lastLoginAt) : 'Chưa đăng nhập'}</MutedCell> },
    { key: 'st', label: 'Trạng thái', w: 0.8, render: (a) => <StatusBadge tone={a.status === 'active' ? 'g' : 'r'}>{a.status === 'active' ? 'Hoạt động' : 'Tạm ngưng'}</StatusBadge> },
  ];

  const actions = (a: AdminAccount): RowAction[] => {
    const lockedNote = a.locked;
    return [
      { label: 'Đổi vai trò', icon: 'manage_accounts', disabled: lockedNote, onClick: () => slot.show((close) => <EditRoleDialog admin={a} roles={roleList} onClose={close} />) },
      {
        label: 'Đặt lại 2FA',
        icon: 'phonelink_lock',
        onClick: () =>
          slot.show((close) => (
            <ActionDialog icon="phonelink_lock" title={`Đặt lại 2FA · ${a.name}`} body="Tắt cờ 2FA của tài khoản này và gửi email thông báo cho họ." cta="Đặt lại 2FA" successMessage={`Đã đặt lại 2FA · ${a.name}`} run={() => act.mutateAsync({ path: `/system/admins/${a.id}/reset-2fa`, body: {} })} onClose={close} />
          )),
      },
      a.status === 'suspended'
        ? { label: 'Kích hoạt lại', icon: 'check_circle', disabled: lockedNote, onClick: () => void quick(a, '/enable', `Đã kích hoạt lại ${a.name}`, 'POST') }
        : {
            label: 'Tạm ngưng',
            icon: 'block',
            danger: true,
            disabled: lockedNote,
            onClick: () =>
              slot.show((close) => (
                <ActionDialog icon="block" danger title={`Tạm ngưng · ${a.name}`} body="Tài khoản này không truy cập được khu vực quản trị cho tới khi kích hoạt lại." cta="Tạm ngưng" noteLabel="Lý do (tùy chọn)" successMessage={`Đã tạm ngưng ${a.name}`} run={(v) => act.mutateAsync({ path: `/system/admins/${a.id}/suspend`, body: { reason: v.note || undefined } })} onClose={close} />
              )),
          },
      {
        label: 'Gỡ quyền quản trị',
        icon: 'person_remove',
        danger: true,
        disabled: lockedNote,
        onClick: () =>
          slot.show((close) => (
            <ActionDialog icon="person_remove" danger title={`Gỡ quyền quản trị · ${a.name}`} body="Người này vẫn giữ tài khoản thành viên nhưng không còn vào được khu vực quản trị." cta="Gỡ quyền" successMessage={`Đã gỡ quyền của ${a.name}`} run={() => act.mutateAsync({ method: 'DELETE', path: `/system/admins/${a.id}` })} onClose={close} />
          )),
      },
    ];
  };

  return (
    <>
      <PageHeader
        title="Tài khoản quản trị"
        subtitle="Những người có quyền truy cập trang quản trị."
        actions={
          <AdminButton kind="primary" icon="person_add" disabled={roles.isPending || roles.isError} onClick={() => slot.show((close) => <CreateAdminDialog roles={roleList} onClose={close} />)}>
            Tạo quản trị viên
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
                  ['Vai trò', roleName(a.role.key, a.role.name)],
                  ['Nguồn', a.source === 'env' ? 'Cấu hình hệ thống (Super Admin gốc)' : 'Nhân viên được cấp quyền'],
                  ['2FA', a.twoFactorEnabled ? 'Đã bật' : 'Chưa bật'],
                  ['Đăng nhập gần nhất', a.lastLoginAt ? formatDateTime(a.lastLoginAt) : 'Chưa đăng nhập'],
                  ['Tham gia', formatDateTime(a.createdAt)],
                  ['Trạng thái', a.status === 'active' ? 'Hoạt động' : 'Tạm ngưng'],
                ]}
              />
              {a.locked && <div className="rounded-xl bg-[#faf7f4] px-3.5 py-2.5 text-[13px] text-stone-500">Tài khoản này được khóa: không thể đổi vai trò, tạm ngưng hay gỡ quyền (tài khoản gốc hoặc chính bạn).</div>}
            </PreviewDialog>
          ))
        }
        actions={actions}
        search={{ value: t.q, onChange: t.onQ, placeholder: 'Tìm quản trị viên...' }}
        filters={[
          { key: 'role', label: 'Vai trò', value: t.f.role, options: roleList.map((r) => ({ value: r.key, label: roleName(r.key, r.name) })), onChange: t.setFilter('role') },
          {
            key: 'status',
            label: 'Trạng thái',
            value: t.f.status,
            options: [
              { value: 'active', label: 'Hoạt động' },
              { value: 'suspended', label: 'Tạm ngưng' },
            ],
            onChange: t.setFilter('status'),
          },
        ]}
        onClearFilters={t.clear}
        loading={list.isPending}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        emptyText="Chưa có quản trị viên nào."
        page={list.data ? { page: list.data.meta.page, totalPages: list.data.meta.totalPages, total: list.data.meta.total, limit: LIMIT, onPage: t.setPage } : undefined}
      />
      {slot.el}
    </>
  );
}

/* ============================== Vai trò & Quyền ============================== */

function CreateRoleDialog({ perms, onClose }: { perms: MatrixPermission[]; onClose: () => void }) {
  const act = useAdminAction();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [sel, setSel] = useState<string[]>(['dashboard.view']);
  return (
    <ActionDialog
      icon="add_moderator"
      title="Tạo vai trò"
      body="Vai trò tùy chỉnh gồm các quyền bạn chọn. Quyền quản lý quản trị viên chỉ dành cho Super Admin."
      cta="Tạo vai trò"
      disabledExtra={!name.trim() || sel.length === 0}
      successMessage="Đã tạo vai trò"
      run={() => act.mutateAsync({ path: '/system/roles', body: { name: name.trim(), description: desc.trim() || undefined, permissions: sel } })}
      onClose={onClose}
    >
      <InputField label="Tên vai trò" value={name} onChange={setName} maxLength={60} />
      <TextAreaField label="Mô tả (tùy chọn)" value={desc} onChange={setDesc} maxLength={300} />
      <OptionChips multi label="Quyền" options={perms.filter((p) => p.key !== 'admin.manage').map((p) => ({ value: p.key, label: p.label }))} value={sel} onChange={(v) => setSel(v as string[])} />
    </ActionDialog>
  );
}

function EditRoleInfoDialog({ role, onClose }: { role: RoleDef; onClose: () => void }) {
  const act = useAdminAction();
  const [name, setName] = useState(role.name);
  const [desc, setDesc] = useState(role.description ?? '');
  return (
    <ActionDialog
      icon="edit"
      title={`Sửa vai trò · ${role.name}`}
      cta="Lưu"
      disabledExtra={!name.trim()}
      successMessage="Đã cập nhật vai trò"
      run={() => act.mutateAsync({ method: 'PATCH', path: `/system/roles/${role.key}`, body: { name: name.trim(), description: desc.trim() } })}
      onClose={onClose}
    >
      <InputField label="Tên vai trò" value={name} onChange={setName} maxLength={60} />
      <TextAreaField label="Mô tả" value={desc} onChange={setDesc} maxLength={300} />
    </ActionDialog>
  );
}

export function RolesView() {
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
      toast.error('Quyền quản lý quản trị viên chỉ dành cho Super Admin.');
      return;
    }
    const id = `${role.key}:${perm.key}`;
    setBusy(id);
    try {
      await act.mutateAsync({ method: 'PATCH', path: `/system/roles/${role.key}`, body: { permission: perm.key, granted: next } });
      toast.success(`${next ? 'Đã cấp' : 'Đã thu hồi'} "${perm.label}" cho ${role.label}`);
    } catch (e) {
      toast.error(errMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Vai trò & Quyền"
        subtitle="Bấm vào ô để cấp hoặc thu hồi quyền."
        actions={
          <AdminButton kind="primary" icon="add" disabled={!data} onClick={() => slot.show((close) => <CreateRoleDialog perms={perms} onClose={close} />)}>
            Tạo vai trò
          </AdminButton>
        }
      />
      <section className={`${CARD_CLS} overflow-hidden`}>
        {q.isPending && <LoadingBlock />}
        {q.isError && <ErrorBlock error={q.error} onRetry={() => void q.refetch()} />}
        {data && <PermissionMatrix roles={roles} permissions={perms} granted={granted} busyCell={busy} onToggle={(r, p, n) => void toggle(r, p, n)} />}
      </section>
      {data && (
        <Card title="Vai trò" sub="Super Admin luôn đủ quyền và không sửa được. Vai trò hệ thống không xóa được.">
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))' }}>
            {data.roles.map((r) => (
              <div key={r.key} className="flex flex-col gap-2 rounded-[14px] border border-[#f1ebe6] p-3.5">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">{roleName(r.key, r.name)}</span>
                  {r.locked && <MaterialIcon name="lock" size={16} color="#a8a29e" />}
                  {r.isSystem ? <StatusBadge tone="x">Hệ thống</StatusBadge> : <StatusBadge tone="b">Tùy chỉnh</StatusBadge>}
                </div>
                {r.description && <div className="text-xs leading-normal text-stone-500">{r.description}</div>}
                <div className="text-xs text-stone-400">
                  {r.memberCount} thành viên · {r.permissions.length} quyền
                </div>
                {!r.locked && (
                  <div className="mt-auto flex gap-1.5 pt-1">
                    <button type="button" className="h-[30px] rounded-[9px] border border-[#e7e0da] bg-white px-3 text-[12.5px] font-semibold hover:bg-[#fff4ec]" onClick={() => slot.show((close) => <EditRoleInfoDialog role={r} onClose={close} />)}>
                      Sửa
                    </button>
                    {!r.isSystem && (
                      <button
                        type="button"
                        disabled={r.memberCount > 0}
                        title={r.memberCount > 0 ? 'Vai trò đang được dùng' : undefined}
                        className="h-[30px] rounded-[9px] border border-[#fecaca] bg-white px-3 text-[12.5px] font-semibold text-[#b91c1c] hover:bg-[#fef2f2] disabled:opacity-40"
                        onClick={() =>
                          slot.show((close) => (
                            <ActionDialog icon="delete" danger title={`Xóa vai trò · ${r.name}`} body="Vai trò sẽ bị xóa vĩnh viễn." cta="Xóa" successMessage="Đã xóa vai trò" run={() => act.mutateAsync({ method: 'DELETE', path: `/system/roles/${r.key}` })} onClose={close} />
                          ))
                        }
                      >
                        Xóa
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

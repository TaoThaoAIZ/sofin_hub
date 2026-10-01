import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AdminUser } from '../types';
import { BanUserModal, ReinstateUserModal, RestrictUserModal, SuspendUserModal, WarnModal, banSummary } from './ActionModals';
import type { RowAction } from './DataTable';

type ModalKind = 'restrict' | 'suspend' | 'ban' | 'reinstate' | 'warn';

/**
 * Hành động chung cho một người dùng (xem / hạn chế / tạm ngưng / cấm / khôi phục / cảnh cáo).
 * `modalEl` phải được render trong trang.
 */
export function useUserActions(onDone?: () => void) {
  const navigate = useNavigate();
  const [modal, setModal] = useState<{ kind: ModalKind; u: AdminUser } | null>(null);

  const actionsFor = (u: AdminUser, opts: { includeView?: boolean; reinstateFirst?: boolean } = {}): RowAction[] => {
    const list: RowAction[] = [];
    const reinstate: RowAction = { label: 'Khôi phục', icon: 'restart_alt', onClick: () => setModal({ kind: 'reinstate', u }) };
    if (opts.reinstateFirst && u.status !== 'active') list.push(reinstate);
    if (opts.includeView !== false) list.push({ label: 'Xem', onClick: () => navigate(`/admin/users/${u.id}`) });
    if (u.status === 'active') list.push({ label: 'Hạn chế', icon: 'block', onClick: () => setModal({ kind: 'restrict', u }) });
    if (u.status === 'active' || u.status === 'restricted') list.push({ label: 'Tạm ngưng', icon: 'pause_circle', danger: true, onClick: () => setModal({ kind: 'suspend', u }) });
    if (u.status !== 'banned') list.push({ label: 'Cấm', icon: 'gavel', danger: true, onClick: () => setModal({ kind: 'ban', u }) });
    if (!opts.reinstateFirst && u.status !== 'active') list.push(reinstate);
    list.push({ label: 'Cảnh cáo', icon: 'warning', onClick: () => setModal({ kind: 'warn', u }) });
    return list;
  };

  const close = () => setModal(null);
  let modalEl = null;
  if (modal) {
    const target = { kind: 'user' as const, userId: modal.u.id, name: modal.u.name };
    if (modal.kind === 'restrict') modalEl = <RestrictUserModal target={target} onClose={close} onDone={onDone} />;
    else if (modal.kind === 'suspend') modalEl = <SuspendUserModal target={target} onClose={close} onDone={onDone} />;
    else if (modal.kind === 'ban') modalEl = <BanUserModal target={target} summary={banSummary(modal.u)} onClose={close} onDone={onDone} />;
    else if (modal.kind === 'warn') modalEl = <WarnModal target={target} onClose={close} onDone={onDone} />;
    else modalEl = <ReinstateUserModal user={{ id: modal.u.id, name: modal.u.name }} onClose={close} onDone={onDone} />;
  }

  return { actionsFor, modalEl, open: (kind: ModalKind, u: AdminUser) => setModal({ kind, u }) };
}

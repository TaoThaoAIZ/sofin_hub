import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCategories } from '../../courses/queries';
import type { AdminCommunity } from '../types';
import { DeleteCommunityModal, RestoreCommunityModal, SuspendCommunityModal, UndeleteCommunityModal, type CommunityRef } from './ActionModals';
import type { RowAction } from './DataTable';

type ModalKind = 'suspend' | 'delete' | 'restore' | 'undelete';

/** Nhãn danh mục (id -> tên tiếng Việt) lấy từ GET /categories; id lạ giữ nguyên. */
export function useCategoryLabel() {
  const cats = useCategories();
  const map = new Map((cats.data ?? []).map((c) => [c.id as string, c.name]));
  return { label: (id: string) => map.get(id) ?? id, options: (cats.data ?? []).map((c) => ({ value: c.id as string, label: c.name })) };
}

/**
 * Hành động chung cho một cộng đồng (xem / mở / xét duyệt / tạm ngưng / khôi phục / xóa) dùng ở danh sách, trang chi tiết...
 * Trả về `actionsFor(community)` cho menu hàng + `modalEl` phải render ở đâu đó trong trang.
 */
export function useCommunityActions(onDone?: () => void) {
  const navigate = useNavigate();
  const [modal, setModal] = useState<{ kind: ModalKind; c: CommunityRef } | null>(null);
  const open = (kind: ModalKind, c: CommunityRef) => setModal({ kind, c });

  const actionsFor = (c: AdminCommunity, opts: { includeView?: boolean } = { includeView: true }): RowAction[] => {
    const ref = { id: c.id, name: c.name };
    const list: RowAction[] = [];
    if (opts.includeView !== false) list.push({ label: 'Xem', onClick: () => navigate(`/admin/communities/${c.id}`) });
    if (c.status !== 'deleted') list.push({ label: 'Mở cộng đồng', icon: 'open_in_new', onClick: () => window.open(`/communities/${c.id}/community`, '_blank', 'noopener') });
    if (c.status === 'pending_review' || c.status === 'changes_requested') list.push({ label: 'Xét duyệt', icon: 'how_to_reg', onClick: () => navigate(`/admin/communities/review?id=${c.id}`) });
    if (c.status === 'active') list.push({ label: 'Tạm ngưng', icon: 'pause_circle', danger: true, onClick: () => open('suspend', ref) });
    if (c.status === 'suspended') list.push({ label: 'Khôi phục', icon: 'restore', onClick: () => open('restore', ref) });
    if (c.status === 'deleted') list.push({ label: 'Khôi phục', icon: 'restore', onClick: () => open('undelete', ref) });
    if (c.status !== 'deleted') list.push({ label: 'Xóa', icon: 'delete', danger: true, onClick: () => open('delete', ref) });
    return list;
  };

  const close = () => setModal(null);
  const modalEl = modal ? (
    modal.kind === 'suspend' ? (
      <SuspendCommunityModal community={modal.c} onClose={close} onDone={onDone} />
    ) : modal.kind === 'delete' ? (
      <DeleteCommunityModal community={modal.c} onClose={close} onDone={onDone} />
    ) : modal.kind === 'restore' ? (
      <RestoreCommunityModal community={modal.c} onClose={close} onDone={onDone} />
    ) : (
      <UndeleteCommunityModal community={modal.c} onClose={close} onDone={onDone} />
    )
  ) : null;

  return { actionsFor, modalEl, open };
}

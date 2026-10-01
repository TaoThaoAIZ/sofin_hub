import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAssignCase, useDismissCase, useEscalateCase, useResolveCase } from '../queries';
import type { AdminCase } from '../types';
import { BanUserModal, NoteModal, RemoveContentModal, RestrictUserModal, SuspendUserModal, WarnModal } from './ActionModals';
import type { RowAction } from './DataTable';
import { useToast } from './overlay';
import { errMessage } from './ui';

export type CaseModalKind = 'warn' | 'remove' | 'restrict' | 'suspend' | 'ban' | 'dismiss' | 'resolve' | 'escalate';

/**
 * Hành động trên một vụ việc kiểm duyệt (nhận xử lý / bỏ qua / gỡ nội dung / cảnh cáo / hạn chế / tạm ngưng / cấm / đóng / nâng mức).
 * Dùng chung cho hàng đợi và trang chi tiết; `modalEl` render trong trang. `note` là ghi chú nội bộ đang nhập (nếu có).
 */
export function useCaseActions(opts: { onDone?: () => void } = {}) {
  const navigate = useNavigate();
  const toast = useToast();
  const assign = useAssignCase();
  const dismiss = useDismissCase();
  const resolve = useResolveCase();
  const escalate = useEscalateCase();
  const [modal, setModal] = useState<{ kind: CaseModalKind; c: AdminCase; note?: string } | null>(null);

  const open = (kind: CaseModalKind, c: AdminCase, note?: string) => setModal({ kind, c, note });

  const assignToMe = (c: AdminCase) =>
    assign.mutate({ id: c.id }, { onSuccess: () => toast.success(`Đã nhận xử lý · ${c.caseCode}`), onError: (e) => toast.error(errMessage(e)) });

  const actionsFor = (c: AdminCase, o: { includeView?: boolean } = {}): RowAction[] => {
    const decidable = c.status === 'open' || c.status === 'under_review';
    const list: RowAction[] = [];
    if (o.includeView !== false) list.push({ label: 'Duyệt', onClick: () => navigate(`/admin/moderation/cases/${c.id}`) });
    if (decidable) {
      list.push({ label: 'Nhận xử lý', icon: 'person_check', disabled: assign.isPending, onClick: () => assignToMe(c) });
      list.push({ label: 'Bỏ qua', icon: 'do_not_disturb_on', onClick: () => open('dismiss', c) });
      if (c.targetType !== 'member') list.push({ label: 'Gỡ nội dung', icon: 'delete', danger: true, onClick: () => open('remove', c) });
      if (c.reportedUser) {
        list.push({ label: 'Cảnh cáo', icon: 'warning', onClick: () => open('warn', c) });
        list.push({ label: 'Tạm ngưng người dùng', icon: 'pause_circle', danger: true, onClick: () => open('suspend', c) });
      }
    }
    return list;
  };

  const close = () => setModal(null);
  let modalEl = null;
  if (modal) {
    const { kind, c, note } = modal;
    const userTarget = { kind: 'case' as const, caseId: c.id, name: c.reportedUser?.name ?? 'người dùng' };
    const common = { onClose: close, onDone: opts.onDone };
    if (kind === 'warn') modalEl = <WarnModal target={userTarget} {...common} />;
    else if (kind === 'remove') modalEl = <RemoveContentModal caseId={c.id} title={c.content.title} {...common} />;
    else if (kind === 'restrict') modalEl = <RestrictUserModal target={userTarget} {...common} />;
    else if (kind === 'suspend') modalEl = <SuspendUserModal target={userTarget} defaultNote={note} {...common} />;
    else if (kind === 'ban') modalEl = <BanUserModal target={userTarget} defaultNote={note} {...common} />;
    else if (kind === 'dismiss')
      modalEl = (
        <NoteModal
          icon="do_not_disturb_on"
          title={`Bỏ qua ${c.caseCode}?`}
          body="Vụ việc được đóng với kết luận không vi phạm."
          cta="Bỏ qua vụ việc"
          defaultNote={note}
          pending={dismiss.isPending}
          error={dismiss.isError ? dismiss.error : null}
          successMessage={`Đã đóng · không vi phạm · ${c.caseCode}`}
          run={(n, ok) => dismiss.mutate({ id: c.id, note: n || undefined }, { onSuccess: ok })}
          {...common}
        />
      );
    else if (kind === 'resolve')
      modalEl = (
        <NoteModal
          icon="task_alt"
          title={`Đóng ${c.caseCode}?`}
          body="Vụ việc được đóng mà không kèm hành động xử phạt."
          cta="Đóng vụ việc"
          defaultNote={note}
          pending={resolve.isPending}
          error={resolve.isError ? resolve.error : null}
          successMessage={`Đã đóng · ${c.caseCode}`}
          run={(n, ok) => resolve.mutate({ id: c.id, note: n || undefined }, { onSuccess: ok })}
          {...common}
        />
      );
    else
      modalEl = (
        <NoteModal
          icon="priority_high"
          title={`Nâng mức rủi ro ${c.caseCode}?`}
          body="Mức rủi ro của vụ việc tăng một bậc và chuyển sang trạng thái đang xem xét."
          cta="Nâng mức"
          defaultNote={note}
          pending={escalate.isPending}
          error={escalate.isError ? escalate.error : null}
          successMessage={`Đã nâng mức · ${c.caseCode}`}
          run={(n, ok) => escalate.mutate({ id: c.id, note: n || undefined }, { onSuccess: ok })}
          {...common}
        />
      );
  }

  return { actionsFor, modalEl, open, assignToMe, assigning: assign.isPending };
}

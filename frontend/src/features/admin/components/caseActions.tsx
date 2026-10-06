import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('admin-components');
  const navigate = useNavigate();
  const toast = useToast();
  const assign = useAssignCase();
  const dismiss = useDismissCase();
  const resolve = useResolveCase();
  const escalate = useEscalateCase();
  const [modal, setModal] = useState<{ kind: CaseModalKind; c: AdminCase; note?: string } | null>(null);

  const open = (kind: CaseModalKind, c: AdminCase, note?: string) => setModal({ kind, c, note });

  const assignToMe = (c: AdminCase) =>
    assign.mutate({ id: c.id }, { onSuccess: () => toast.success(t('ca.assigned', { code: c.caseCode })), onError: (e) => toast.error(errMessage(e)) });

  const actionsFor = (c: AdminCase, o: { includeView?: boolean } = {}): RowAction[] => {
    const decidable = c.status === 'open' || c.status === 'under_review';
    const list: RowAction[] = [];
    if (o.includeView !== false) list.push({ label: t('ca.view'), onClick: () => navigate(`/admin/moderation/cases/${c.id}`) });
    if (decidable) {
      list.push({ label: t('ca.assign'), icon: 'person_check', disabled: assign.isPending, onClick: () => assignToMe(c) });
      list.push({ label: t('ca.dismiss'), icon: 'do_not_disturb_on', onClick: () => open('dismiss', c) });
      if (c.targetType !== 'member') list.push({ label: t('ca.remove'), icon: 'delete', danger: true, onClick: () => open('remove', c) });
      if (c.reportedUser) {
        list.push({ label: t('ca.warn'), icon: 'warning', onClick: () => open('warn', c) });
        list.push({ label: t('ca.suspend'), icon: 'pause_circle', danger: true, onClick: () => open('suspend', c) });
      }
    }
    return list;
  };

  const close = () => setModal(null);
  let modalEl = null;
  if (modal) {
    const { kind, c, note } = modal;
    const userTarget = { kind: 'case' as const, caseId: c.id, name: c.reportedUser?.name ?? t('ca.userFallback') };
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
          title={t('ca.dismissModal.title', { code: c.caseCode })}
          body={t('ca.dismissModal.body')}
          cta={t('ca.dismissModal.cta')}
          defaultNote={note}
          pending={dismiss.isPending}
          error={dismiss.isError ? dismiss.error : null}
          successMessage={t('ca.dismissModal.done', { code: c.caseCode })}
          run={(n, ok) => dismiss.mutate({ id: c.id, note: n || undefined }, { onSuccess: ok })}
          {...common}
        />
      );
    else if (kind === 'resolve')
      modalEl = (
        <NoteModal
          icon="task_alt"
          title={t('ca.resolveModal.title', { code: c.caseCode })}
          body={t('ca.resolveModal.body')}
          cta={t('ca.resolveModal.cta')}
          defaultNote={note}
          pending={resolve.isPending}
          error={resolve.isError ? resolve.error : null}
          successMessage={t('ca.resolveModal.done', { code: c.caseCode })}
          run={(n, ok) => resolve.mutate({ id: c.id, note: n || undefined }, { onSuccess: ok })}
          {...common}
        />
      );
    else
      modalEl = (
        <NoteModal
          icon="priority_high"
          title={t('ca.escalateModal.title', { code: c.caseCode })}
          body={t('ca.escalateModal.body')}
          cta={t('ca.escalateModal.cta')}
          defaultNote={note}
          pending={escalate.isPending}
          error={escalate.isError ? escalate.error : null}
          successMessage={t('ca.escalateModal.done', { code: c.caseCode })}
          run={(n, ok) => escalate.mutate({ id: c.id, note: n || undefined }, { onSuccess: ok })}
          {...common}
        />
      );
  }

  return { actionsFor, modalEl, open, assignToMe, assigning: assign.isPending };
}

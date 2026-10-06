import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Trans, useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { ApiError } from '../../../lib/api';
import type { CommunityMember } from '../../community/types';
import { useBanMember, useChangeMemberRole, useKickMember, useReportMember } from '../queries';
import { REPORT_REASONS, ROLE_LABEL, ROLE_RANK, type AssignableRole, type ReportReason, type ViewerRole } from '../types';
import { CancelButton, ErrorLine, errorText, INPUT_CLASS, Modal, PrimaryButton } from './Modal';

export type Notify = (message: string, kind?: 'ok' | 'error') => void;

const ASSIGNABLE: AssignableRole[] = ['member', 'mod', 'admin'];

/** Người xem có được quản trị (đổi vai trò/kick/ban) thành viên này không — chỉ là UX, BE mới là nơi chốt quyền. */
export function canManageMember(viewerRole: ViewerRole | null | undefined, viewerId: string | undefined, m: CommunityMember) {
  if (!viewerRole || ROLE_RANK[viewerRole] < ROLE_RANK.admin) return false;
  if (m.id === viewerId) return false;
  const target = m.roleDetail ?? (m.role === 'admin' ? 'admin' : 'member');
  if (target === 'owner') return false;
  return ROLE_RANK[viewerRole] > ROLE_RANK[target];
}

/** Vai trò mà người xem được phép gán: admin chỉ đặt member/mod; owner (hoặc platform admin) đặt được cả admin. */
export function assignableRoles(viewerRole: ViewerRole | null | undefined): AssignableRole[] {
  if (!viewerRole) return [];
  return ROLE_RANK[viewerRole] >= ROLE_RANK.owner ? ASSIGNABLE : ASSIGNABLE.filter((r) => r !== 'admin');
}

type Dialog = 'kick' | 'ban' | 'report' | null;

/** Nút "…" ở mỗi hàng thành viên + menu hành động. Menu render qua portal để không bị cắt bởi vùng cuộn ngang của bảng. */
export function MemberActionsMenu({
  courseId,
  member,
  viewerRole,
  viewerId,
  onNotify,
}: {
  courseId: string;
  member: CommunityMember;
  viewerRole: ViewerRole | null | undefined;
  viewerId: string | undefined;
  onNotify: Notify;
}) {
  const { t } = useTranslation('communities');
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);

  const changeRole = useChangeMemberRole(courseId);
  const isSelf = member.id === viewerId;
  const manage = canManageMember(viewerRole, viewerId, member);
  const currentRole = member.roleDetail ?? (member.role === 'admin' ? 'admin' : 'member');
  const roles = manage ? assignableRoles(viewerRole).filter((r) => r !== currentRole) : [];

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !btnRef.current?.contains(t)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  const fail = (e: unknown) => {
    // Thành viên minh họa (id 'seed:...') không tồn tại thật → BE trả 404
    if (member.id.startsWith('seed:') && e instanceof ApiError && e.status === 404) {
      onNotify(t('memberMenu.seedError'), 'error');
    } else {
      onNotify(errorText(e), 'error');
    }
  };

  const setRole = (role: AssignableRole) => {
    setOpen(false);
    changeRole.mutate(
      { userId: member.id, role },
      { onSuccess: () => onNotify(t('memberMenu.roleChanged', { name: member.name, role: ROLE_LABEL[role] })), onError: fail },
    );
  };

  const copyHandle = () => {
    void navigator.clipboard?.writeText(`@${member.handle}`);
    setOpen(false);
    onNotify(t('memberMenu.copied', { handle: member.handle }));
  };

  const openDialog = (d: Dialog) => {
    setOpen(false);
    setDialog(d);
  };

  const itemClass = 'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] hover:bg-stone-50';

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={t('memberMenu.optionsFor', { name: member.name })}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="grid h-9 w-[38px] place-items-center rounded-[10px] border border-[rgba(120,60,20,.12)] bg-white hover:bg-[#fff7f0]"
      >
        <MaterialIcon name="more_horiz" size={18} color="#1c1917" />
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ position: 'fixed', top: pos.top, right: pos.right }}
            className="z-50 w-60 rounded-xl border border-[rgba(120,60,20,.12)] bg-white p-1.5 shadow-lg"
          >
            <Link to={`/users/${member.id}`} role="menuitem" className={itemClass} onClick={() => setOpen(false)}>
              <MaterialIcon name="person" size={18} color="#57534e" /> {t('memberMenu.viewProfile')}
            </Link>
            <button type="button" role="menuitem" className={itemClass} onClick={copyHandle}>
              <MaterialIcon name="content_copy" size={18} color="#57534e" /> {t('memberMenu.copyHandle', { handle: member.handle })}
            </button>

            {roles.length > 0 && (
              <>
                <div className="px-2.5 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-stone-500">{t('memberMenu.changeRole')}</div>
                {roles.map((r) => (
                  <button key={r} type="button" role="menuitem" className={itemClass} onClick={() => setRole(r)}>
                    <MaterialIcon name="shield_person" size={18} color="#57534e" />
                    {t('memberMenu.setRole', { role: ROLE_LABEL[r] })}
                  </button>
                ))}
              </>
            )}

            {manage && (
              <>
                <div className="my-1 border-t border-[rgba(120,60,20,.08)]" />
                <button type="button" role="menuitem" className={`${itemClass} text-red-600`} onClick={() => openDialog('kick')}>
                  <MaterialIcon name="person_remove" size={18} color="#dc2626" /> {t('memberMenu.removeFromCommunity')}
                </button>
                <button type="button" role="menuitem" className={`${itemClass} text-red-600`} onClick={() => openDialog('ban')}>
                  <MaterialIcon name="block" size={18} color="#dc2626" /> {t('memberMenu.banMember')}
                </button>
              </>
            )}

            {!isSelf && (
              <>
                <div className="my-1 border-t border-[rgba(120,60,20,.08)]" />
                <button type="button" role="menuitem" className={itemClass} onClick={() => openDialog('report')}>
                  <MaterialIcon name="flag" size={18} color="#57534e" /> {t('memberMenu.reportMember')}
                </button>
              </>
            )}
          </div>,
          document.body,
        )}

      {dialog === 'kick' && <KickDialog courseId={courseId} member={member} onClose={() => setDialog(null)} onNotify={onNotify} onFail={fail} />}
      {dialog === 'ban' && <BanDialog courseId={courseId} member={member} onClose={() => setDialog(null)} onNotify={onNotify} onFail={fail} />}
      {dialog === 'report' && <ReportDialog courseId={courseId} member={member} onClose={() => setDialog(null)} onNotify={onNotify} />}
    </>
  );
}

interface DialogProps {
  courseId: string;
  member: CommunityMember;
  onClose: () => void;
  onNotify: Notify;
}

function KickDialog({ courseId, member, onClose, onNotify, onFail }: DialogProps & { onFail: (e: unknown) => void }) {
  const { t } = useTranslation('communities');
  const kick = useKickMember(courseId);
  return (
    <Modal
      title={t('memberMenu.removeFromCommunity')}
      icon="person_remove"
      onClose={onClose}
      footer={
        <>
          <CancelButton onClick={onClose} />
          <PrimaryButton
            danger
            disabled={kick.isPending}
            onClick={() =>
              kick.mutate(member.id, {
                onSuccess: () => {
                  onNotify(t('kick.removed', { name: member.name }));
                  onClose();
                },
                onError: (e) => {
                  onFail(e);
                  onClose();
                },
              })
            }
          >
            {kick.isPending ? t('kick.removing') : t('kick.confirm')}
          </PrimaryButton>
        </>
      }
    >
      <Trans ns="communities" i18nKey="kick.body" values={{ name: member.name }} components={{ b: <b /> }} />
    </Modal>
  );
}

function BanDialog({ courseId, member, onClose, onNotify, onFail }: DialogProps & { onFail: (e: unknown) => void }) {
  const { t } = useTranslation('communities');
  const ban = useBanMember(courseId);
  const [reason, setReason] = useState('');
  return (
    <Modal
      title={t('memberMenu.banMember')}
      icon="block"
      onClose={onClose}
      footer={
        <>
          <CancelButton onClick={onClose} />
          <PrimaryButton
            danger
            disabled={ban.isPending}
            onClick={() =>
              ban.mutate(
                { userId: member.id, reason: reason.trim() },
                {
                  onSuccess: () => {
                    onNotify(t('ban.banned', { name: member.name }));
                    onClose();
                  },
                  onError: (e) => {
                    onFail(e);
                    onClose();
                  },
                },
              )
            }
          >
            {ban.isPending ? t('ban.banning') : t('memberMenu.banMember')}
          </PrimaryButton>
        </>
      }
    >
      <Trans ns="communities" i18nKey="ban.body" values={{ name: member.name }} components={{ b: <b /> }} />
      <label className="mt-3 block text-[13px] font-semibold text-stone-700">
        {t('ban.reasonLabel')}
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={3} className={`${INPUT_CLASS} mt-1.5 resize-none font-normal`} />
      </label>
    </Modal>
  );
}

function ReportDialog({ courseId, member, onClose, onNotify }: DialogProps) {
  const { t } = useTranslation('communities');
  const report = useReportMember(courseId);
  const [reason, setReason] = useState<ReportReason>('spam');
  const [detail, setDetail] = useState('');
  return (
    <Modal
      title={t('memberMenu.reportMember')}
      icon="flag"
      onClose={onClose}
      footer={
        <>
          <CancelButton onClick={onClose} />
          <PrimaryButton
            disabled={report.isPending}
            onClick={() =>
              report.mutate(
                { userId: member.id, reason, detail: detail.trim() || undefined },
                {
                  onSuccess: () => {
                    onNotify(t('report.sent'));
                    onClose();
                  },
                },
              )
            }
          >
            {report.isPending ? t('report.sending') : t('report.send')}
          </PrimaryButton>
        </>
      }
    >
      <Trans ns="communities" i18nKey="report.body" values={{ name: member.name }} components={{ b: <b /> }} />
      <div className="mt-3 flex flex-col gap-1.5" role="radiogroup" aria-label={t('report.reasonGroup')}>
        {REPORT_REASONS.map((r) => (
          <label key={r.key} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13.5px] text-stone-800 hover:bg-stone-50">
            <input type="radio" name="report-reason" checked={reason === r.key} onChange={() => setReason(r.key)} className="accent-[#f26a1b]" />
            {r.label}
          </label>
        ))}
      </div>
      <textarea
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
        maxLength={1000}
        rows={3}
        placeholder={t('report.detailPlaceholder')}
        className={`${INPUT_CLASS} mt-3 resize-none`}
      />
      {report.isError && <ErrorLine>{errorText(report.error)}</ErrorLine>}
    </Modal>
  );
}

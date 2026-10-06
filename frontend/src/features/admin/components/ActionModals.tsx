import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../../i18n';
import { formatCents, formatDate } from '../../../lib/datetime';
import {
  useApproveCommunity,
  useBanCaseUser,
  useBanUser,
  useDeleteCommunity,
  useRejectCommunity,
  useRemoveCaseContent,
  useReinstateUser,
  useRequestCommunityChanges,
  useRestoreCommunity,
  useRestrictCaseUser,
  useRestrictUser,
  useSuspendCaseUser,
  useSuspendCommunity,
  useSuspendUser,
  useUndeleteCommunity,
  useWarnCase,
  useWarnUser,
} from '../queries';
import { DURATION_LABEL, RESTRICTION_LABEL, type DurationKey, type RestrictionKey } from '../types';
import { CheckField, InfoGrid, InputField, ModalShell, OptionChips, TextAreaField, WarnBox, useToast } from './overlay';
import { errMessage } from './ui';

/**
 * Các modal thao tác của Admin (bám bản thiết kế): mỗi modal gọi API thật qua hook mutation,
 * hiển thị lỗi ngay trong modal, thành công thì toast + đóng + (tuỳ chọn) onDone.
 * Lý do gửi lên là nhãn tiếng Việt (backend nhận chuỗi tự do ≤ 500 ký tự).
 */

/** Giá trị gửi lên backend giữ nguyên nhãn tiếng Việt; nhãn hiển thị dịch lazy theo ngôn ngữ hiện tại. */
const opt = (items: readonly (readonly [string, string])[]) =>
  items.map(([value, key]) => ({
    value,
    get label() {
      return i18n.t(`reasons.${key}`, { ns: 'admin-components' });
    },
  }));
export const USER_REASONS = opt([
  ['Spam', 'spam'],
  ['Quấy rối', 'harassment'],
  ['Ngôn từ thù ghét', 'hate'],
  ['Lừa đảo', 'scam'],
  ['Bản quyền', 'copyright'],
  ['Nội dung nhạy cảm', 'sensitive'],
  ['Khác', 'other'],
]);
const COMMUNITY_SUSPEND_REASONS = opt([
  ['Vi phạm chính sách', 'policy'],
  ['Gian lận', 'fraud'],
  ['Spam', 'spam'],
  ['Bản quyền', 'copyright'],
  ['Rủi ro thanh toán', 'paymentRisk'],
  ['Khác', 'other'],
]);
const COMMUNITY_DELETE_REASONS = opt([
  ['Chủ sở hữu yêu cầu', 'ownerRequest'],
  ['Vi phạm chính sách', 'policy'],
  ['Gian lận', 'fraud'],
  ['Spam', 'spam'],
  ['Không hoạt động', 'inactive'],
]);
const COMMUNITY_REJECT_REASONS = opt([
  ['Vi phạm chính sách', 'policy'],
  ['Nội dung không phù hợp', 'inappropriate'],
  ['Thông tin gây hiểu lầm', 'misleading'],
  ['Trùng lặp', 'duplicate'],
  ['Khác', 'other'],
]);
const DURATIONS = (Object.keys(DURATION_LABEL) as DurationKey[]).map((d) => ({
  value: d,
  get label() {
    return DURATION_LABEL[d];
  },
}));
const RESTRICTIONS = (Object.keys(RESTRICTION_LABEL) as RestrictionKey[]).map((k) => ({
  value: k,
  get label() {
    return RESTRICTION_LABEL[k];
  },
}));

interface BaseProps {
  onClose: () => void;
  /** Gọi sau khi thao tác thành công (vd. điều hướng, bỏ chọn dòng). */
  onDone?: () => void;
}

/** Gói chung: toast + đóng + onDone khi thành công. */
function useDone({ onClose, onDone }: BaseProps) {
  const toast = useToast();
  return (message: string) => {
    toast.success(message);
    onClose();
    onDone?.();
  };
}

/* ------------------------------ Cộng đồng ------------------------------ */

export interface CommunityRef {
  id: string;
  name: string;
}

export function SuspendCommunityModal({ community, onClose, onDone }: { community: CommunityRef } & BaseProps) {
  const { t } = useTranslation('admin-components');
  const done = useDone({ onClose, onDone });
  const m = useSuspendCommunity();
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState<DurationKey>('7d');
  const [note, setNote] = useState('');
  return (
    <ModalShell
      icon="pause_circle"
      danger
      title={t('am.suspendCommunity.title', { name: community.name })}
      body={t('am.suspendCommunity.body')}
      cta={t('am.suspendCommunity.cta')}
      pending={m.isPending}
      disabled={!reason}
      error={m.isError ? errMessage(m.error) : null}
      onClose={onClose}
      onConfirm={() => m.mutate({ id: community.id, reason, duration, note: note.trim() || undefined }, { onSuccess: () => done(t('am.suspendCommunity.done', { name: community.name })) })}
    >
      <OptionChips label={t('am.reason')} options={COMMUNITY_SUSPEND_REASONS} value={reason} onChange={(v) => setReason(v as string)} />
      <OptionChips label={t('am.duration')} options={DURATIONS} value={duration} onChange={(v) => setDuration(v as DurationKey)} />
      <TextAreaField label={t('am.internalNote')} value={note} onChange={setNote} placeholder={t('am.adminOnly')} />
    </ModalShell>
  );
}

export function DeleteCommunityModal({ community, onClose, onDone }: { community: CommunityRef } & BaseProps) {
  const { t } = useTranslation('admin-components');
  const done = useDone({ onClose, onDone });
  const m = useDeleteCommunity();
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [word, setWord] = useState('');
  return (
    <ModalShell
      icon="delete_forever"
      danger
      title={t('am.deleteCommunity.title')}
      body={t('am.deleteCommunity.body', { name: community.name })}
      cta={t('am.deleteCommunity.cta')}
      pending={m.isPending}
      disabled={!reason || word !== 'DELETE'}
      error={m.isError ? errMessage(m.error) : null}
      onClose={onClose}
      onConfirm={() => m.mutate({ id: community.id, reason, note: note.trim() || undefined }, { onSuccess: () => done(t('am.deleteCommunity.done', { name: community.name })) })}
    >
      <WarnBox lines={[t('am.deleteCommunity.warn1'), t('am.deleteCommunity.warn2'), t('am.deleteCommunity.warn3')]} />
      <OptionChips label={t('am.reason')} options={COMMUNITY_DELETE_REASONS} value={reason} onChange={(v) => setReason(v as string)} />
      <TextAreaField label={t('am.internalNote')} value={note} onChange={setNote} placeholder={t('am.adminOnly')} />
      <InputField label={t('am.deleteCommunity.confirmLabel')} value={word} onChange={setWord} placeholder="DELETE" mono />
    </ModalShell>
  );
}

/** Khôi phục cộng đồng đã xóa (undelete) — hiển thị thông tin xóa nếu có. */
export function UndeleteCommunityModal({ community, info, onClose, onDone }: { community: CommunityRef; info?: [string, string][] } & BaseProps) {
  const { t } = useTranslation('admin-components');
  const done = useDone({ onClose, onDone });
  const m = useUndeleteCommunity();
  return (
    <ModalShell
      icon="restore"
      title={t('am.undelete.title', { name: community.name })}
      body={t('am.undelete.body')}
      cta={t('am.restoreCommunity.cta')}
      pending={m.isPending}
      error={m.isError ? errMessage(m.error) : null}
      onClose={onClose}
      onConfirm={() => m.mutate({ id: community.id }, { onSuccess: () => done(t('am.restoreCommunity.done', { name: community.name })) })}
    >
      {info && info.length > 0 && <InfoGrid items={info} />}
    </ModalShell>
  );
}

/** Gỡ tạm ngưng (suspended → active). */
export function RestoreCommunityModal({ community, onClose, onDone }: { community: CommunityRef } & BaseProps) {
  const { t } = useTranslation('admin-components');
  const done = useDone({ onClose, onDone });
  const m = useRestoreCommunity();
  const [note, setNote] = useState('');
  return (
    <ModalShell
      icon="restore"
      title={t('am.undelete.title', { name: community.name })}
      body={t('am.restoreCommunity.body')}
      cta={t('am.restoreCommunity.cta')}
      pending={m.isPending}
      error={m.isError ? errMessage(m.error) : null}
      onClose={onClose}
      onConfirm={() => m.mutate({ id: community.id, note: note.trim() || undefined }, { onSuccess: () => done(t('am.restoreCommunity.done', { name: community.name })) })}
    >
      <TextAreaField label={t('am.internalNote')} value={note} onChange={setNote} placeholder={t('am.adminOnly')} />
    </ModalShell>
  );
}

export function ApproveCommunityModal({ community, onClose, onDone }: { community: CommunityRef } & BaseProps) {
  const { t } = useTranslation('admin-components');
  const done = useDone({ onClose, onDone });
  const m = useApproveCommunity();
  const [note, setNote] = useState('');
  return (
    <ModalShell
      icon="check_circle"
      title={t('am.approve.title', { name: community.name })}
      body={t('am.approve.body')}
      cta={t('am.approve.cta')}
      pending={m.isPending}
      error={m.isError ? errMessage(m.error) : null}
      onClose={onClose}
      onConfirm={() => m.mutate({ id: community.id, note: note.trim() || undefined }, { onSuccess: () => done(t('am.approve.done', { name: community.name })) })}
    >
      <TextAreaField label={t('am.approve.noteLabel')} value={note} onChange={setNote} placeholder={t('am.approve.notePh')} />
    </ModalShell>
  );
}

const CHANGE_TOPICS = opt([
  ['Hồ sơ cộng đồng', 'topicProfile'],
  ['Mô tả', 'topicDescription'],
  ['Giá', 'topicPrice'],
  ['Chất lượng nội dung', 'topicQuality'],
  ['Tuân thủ chính sách', 'topicCompliance'],
]);

export function RequestChangesModal({ community, onClose, onDone }: { community: CommunityRef } & BaseProps) {
  const { t } = useTranslation('admin-components');
  const done = useDone({ onClose, onDone });
  const m = useRequestCommunityChanges();
  const [topics, setTopics] = useState<string[]>([]);
  const [msg, setMsg] = useState('');
  const note = [topics.length ? `Cần chỉnh sửa: ${topics.join(', ')}.` : '', msg.trim()].filter(Boolean).join(' ');
  return (
    <ModalShell
      icon="edit_note"
      title={t('am.requestChanges.title', { name: community.name })}
      cta={t('am.requestChanges.cta')}
      pending={m.isPending}
      disabled={!note}
      error={m.isError ? errMessage(m.error) : null}
      onClose={onClose}
      onConfirm={() => m.mutate({ id: community.id, note }, { onSuccess: () => done(t('am.requestChanges.done', { name: community.name })) })}
    >
      <OptionChips label={t('am.requestChanges.topicsLabel')} options={CHANGE_TOPICS} value={topics} onChange={(v) => setTopics(v as string[])} multi />
      <TextAreaField label={t('am.requestChanges.msgLabel')} value={msg} onChange={setMsg} placeholder={t('am.requestChanges.msgPh')} maxLength={480} />
    </ModalShell>
  );
}

export function RejectCommunityModal({ community, onClose, onDone }: { community: CommunityRef } & BaseProps) {
  const { t } = useTranslation('admin-components');
  const done = useDone({ onClose, onDone });
  const m = useRejectCommunity();
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  return (
    <ModalShell
      icon="block"
      danger
      title={t('am.reject.title', { name: community.name })}
      body={t('am.reject.body')}
      cta={t('am.reject.cta')}
      pending={m.isPending}
      disabled={!reason}
      error={m.isError ? errMessage(m.error) : null}
      onClose={onClose}
      onConfirm={() => m.mutate({ id: community.id, reason, note: note.trim() || undefined }, { onSuccess: () => done(t('am.reject.done', { name: community.name })) })}
    >
      <OptionChips label={t('am.reason')} options={COMMUNITY_REJECT_REASONS} value={reason} onChange={(v) => setReason(v as string)} />
      <TextAreaField label={t('am.reject.noteLabel')} value={note} onChange={setNote} placeholder={t('am.adminOnly')} />
    </ModalShell>
  );
}

/* ------------------------------ Người dùng ------------------------------ */

/** Đối tượng thao tác: trực tiếp lên user, hoặc thông qua một vụ việc kiểm duyệt (áp lên người bị báo cáo). */
export type UserTarget = { kind: 'user'; userId: string; name: string } | { kind: 'case'; caseId: string; name: string };

export function RestrictUserModal({ target, onClose, onDone }: { target: UserTarget } & BaseProps) {
  const { t } = useTranslation('admin-components');
  const done = useDone({ onClose, onDone });
  const direct = useRestrictUser();
  const viaCase = useRestrictCaseUser();
  const m = target.kind === 'user' ? direct : viaCase;
  const [what, setWhat] = useState<RestrictionKey[]>(['post']);
  const [duration, setDuration] = useState<DurationKey>('7d');
  const [reason, setReason] = useState('');
  const submit = () => {
    const body = { reason, restrictions: what, duration };
    const opts = { onSuccess: () => done(t('am.restrict.done', { name: target.name })) };
    if (target.kind === 'user') direct.mutate({ id: target.userId, ...body }, opts);
    else viaCase.mutate({ id: target.caseId, ...body }, opts);
  };
  return (
    <ModalShell
      icon="block"
      title={t('am.restrict.title', { name: target.name })}
      body={t('am.restrict.body')}
      cta={t('am.restrict.cta')}
      pending={m.isPending}
      disabled={!reason || what.length === 0}
      error={m.isError ? errMessage(m.error) : null}
      onClose={onClose}
      onConfirm={submit}
    >
      <OptionChips label={t('am.restrict.pick')} options={RESTRICTIONS} value={what} onChange={(v) => setWhat(v as RestrictionKey[])} multi />
      <OptionChips label={t('am.duration')} options={DURATIONS} value={duration} onChange={(v) => setDuration(v as DurationKey)} />
      <OptionChips label={t('am.reason')} options={USER_REASONS} value={reason} onChange={(v) => setReason(v as string)} />
    </ModalShell>
  );
}

export function SuspendUserModal({ target, defaultNote = '', onClose, onDone }: { target: UserTarget; defaultNote?: string } & BaseProps) {
  const { t } = useTranslation('admin-components');
  const done = useDone({ onClose, onDone });
  const direct = useSuspendUser();
  const viaCase = useSuspendCaseUser();
  const m = target.kind === 'user' ? direct : viaCase;
  const [duration, setDuration] = useState<DurationKey>('7d');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState(defaultNote);
  const [notify, setNotify] = useState(true);
  const submit = () => {
    const body = { reason, duration, note: note.trim() || undefined, notify };
    const opts = { onSuccess: () => done(t('am.suspendUser.done', { name: target.name })) };
    if (target.kind === 'user') direct.mutate({ id: target.userId, ...body }, opts);
    else viaCase.mutate({ id: target.caseId, ...body }, opts);
  };
  return (
    <ModalShell
      icon="pause_circle"
      danger
      title={t('am.suspendUser.title', { name: target.name })}
      body={t('am.suspendUser.body')}
      cta={t('am.suspendUser.cta')}
      pending={m.isPending}
      disabled={!reason}
      error={m.isError ? errMessage(m.error) : null}
      onClose={onClose}
      onConfirm={submit}
    >
      <OptionChips label={t('am.duration')} options={DURATIONS} value={duration} onChange={(v) => setDuration(v as DurationKey)} />
      <OptionChips label={t('am.reason')} options={USER_REASONS} value={reason} onChange={(v) => setReason(v as string)} />
      <TextAreaField label={t('am.internalNote')} value={note} onChange={setNote} placeholder={t('am.suspendUser.notePh')} />
      <CheckField text={t('am.suspendUser.notify')} checked={notify} onChange={setNotify} />
    </ModalShell>
  );
}

export function BanUserModal({ target, summary, defaultNote = '', onClose, onDone }: { target: UserTarget; summary?: [string, string][]; defaultNote?: string } & BaseProps) {
  const { t } = useTranslation('admin-components');
  const done = useDone({ onClose, onDone });
  const direct = useBanUser();
  const viaCase = useBanCaseUser();
  const m = target.kind === 'user' ? direct : viaCase;
  const [reason, setReason] = useState('');
  const [evidence, setEvidence] = useState('');
  const [note, setNote] = useState(defaultNote);
  const [word, setWord] = useState('');
  const submit = () => {
    const body = { reason, evidence: evidence.trim() || undefined, note: note.trim() || undefined };
    const opts = { onSuccess: () => done(t('am.ban.done', { name: target.name })) };
    if (target.kind === 'user') direct.mutate({ id: target.userId, ...body }, opts);
    else viaCase.mutate({ id: target.caseId, ...body }, opts);
  };
  return (
    <ModalShell
      icon="gavel"
      danger
      title={t('am.ban.title', { name: target.name })}
      body={t('am.ban.body')}
      cta={t('am.ban.cta')}
      pending={m.isPending}
      disabled={!reason || word !== 'BAN'}
      error={m.isError ? errMessage(m.error) : null}
      onClose={onClose}
      onConfirm={submit}
    >
      {summary && summary.length > 0 && <InfoGrid items={summary} />}
      <OptionChips label={t('am.reason')} options={USER_REASONS} value={reason} onChange={(v) => setReason(v as string)} />
      <TextAreaField label={t('am.ban.evidence')} value={evidence} onChange={setEvidence} placeholder={t('am.ban.evidencePh')} />
      <TextAreaField label={t('am.internalNote')} value={note} onChange={setNote} placeholder={t('am.adminOnly')} />
      <InputField label={t('am.ban.confirmLabel')} value={word} onChange={setWord} placeholder="BAN" mono />
    </ModalShell>
  );
}

/** Khôi phục tài khoản (restricted/suspended/banned → active). */
export function ReinstateUserModal({ user, onClose, onDone }: { user: { id: string; name: string } } & BaseProps) {
  const { t } = useTranslation('admin-components');
  const done = useDone({ onClose, onDone });
  const m = useReinstateUser();
  const [note, setNote] = useState('');
  return (
    <ModalShell
      icon="restart_alt"
      title={t('am.reinstate.title', { name: user.name })}
      body={t('am.reinstate.body')}
      cta={t('am.reinstate.cta')}
      pending={m.isPending}
      error={m.isError ? errMessage(m.error) : null}
      onClose={onClose}
      onConfirm={() => m.mutate({ id: user.id, note: note.trim() || undefined }, { onSuccess: () => done(t('am.reinstate.done', { name: user.name })) })}
    >
      <TextAreaField label={t('am.internalNote')} value={note} onChange={setNote} placeholder={t('am.adminOnly')} />
    </ModalShell>
  );
}

/** Cảnh cáo: trực tiếp lên user (kèm tin nhắn) hoặc từ vụ việc (đóng vụ việc nếu closeCase). */
export function WarnModal({ target, onClose, onDone }: { target: UserTarget } & BaseProps) {
  const { t } = useTranslation('admin-components');
  const done = useDone({ onClose, onDone });
  const direct = useWarnUser();
  const viaCase = useWarnCase();
  const m = target.kind === 'user' ? direct : viaCase;
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const submit = () => {
    const opts = { onSuccess: () => done(t('am.warn.done', { name: target.name })) };
    if (target.kind === 'user') direct.mutate({ id: target.userId, reason, message: message.trim() }, opts);
    else viaCase.mutate({ id: target.caseId, reason, message: message.trim(), closeCase: true }, opts);
  };
  return (
    <ModalShell
      icon="warning"
      title={t('am.warn.title')}
      body={t('am.warn.body', { name: target.name })}
      cta={t('am.warn.cta')}
      pending={m.isPending}
      disabled={!reason || !message.trim()}
      error={m.isError ? errMessage(m.error) : null}
      onClose={onClose}
      onConfirm={submit}
    >
      <OptionChips label={t('am.violation')} options={USER_REASONS} value={reason} onChange={(v) => setReason(v as string)} />
      <TextAreaField label={t('am.warn.msgLabel')} value={message} onChange={setMessage} placeholder={t('am.warn.msgPh')} />
    </ModalShell>
  );
}

export function RemoveContentModal({ caseId, title, onClose, onDone }: { caseId: string; title: string } & BaseProps) {
  const { t } = useTranslation('admin-components');
  const done = useDone({ onClose, onDone });
  const m = useRemoveCaseContent();
  const [reason, setReason] = useState('');
  const [notifyAuthor, setNotifyAuthor] = useState(true);
  return (
    <ModalShell
      icon="delete"
      danger
      title={t('am.remove.title')}
      body={title}
      cta={t('am.remove.cta')}
      pending={m.isPending}
      disabled={!reason}
      error={m.isError ? errMessage(m.error) : null}
      onClose={onClose}
      onConfirm={() => m.mutate({ id: caseId, reason, notifyAuthor }, { onSuccess: () => done(t('am.remove.done')) })}
    >
      <OptionChips label={t('am.violation')} options={USER_REASONS} value={reason} onChange={(v) => setReason(v as string)} />
      <CheckField text={t('am.remove.notifyAuthor')} checked={notifyAuthor} onChange={setNotifyAuthor} />
    </ModalShell>
  );
}

/** Tóm tắt trước khi cấm (từ UserDetail/AdminUser). */
const tc = (k: string) => i18n.t(k, { ns: 'admin-components' });

export const banSummary = (u: { communities: number; revenueCents: number; reports: number; plan?: string }): [string, string][] => [
  [tc('am.banSummary.communities'), String(u.communities)],
  [tc('am.banSummary.paidPlan'), u.plan === 'paid' ? tc('am.banSummary.yes') : tc('am.banSummary.no')],
  [tc('am.banSummary.revenue'), formatCents(u.revenueCents)],
  [tc('am.banSummary.reports'), String(u.reports)],
];

export const trashInfo = (t: { deletedBy: { name: string } | null; deletedByOwner: boolean; deletedAt: string; reason: string | null; purgeAt: string }): [string, string][] => [
  [tc('am.trash.deletedBy'), t.deletedByOwner ? tc('am.trash.owner') : (t.deletedBy?.name ?? '—')],
  [tc('am.trash.deletedAt'), formatDate(t.deletedAt)],
  [tc('am.trash.reason'), t.reason ?? '—'],
  [tc('am.trash.purgeAt'), formatDate(t.purgeAt)],
];

/** Modal xác nhận kèm ô ghi chú (bỏ qua vụ việc, đóng vụ việc, nâng mức rủi ro...). `run` gọi mutation tương ứng. */
export function NoteModal({
  icon,
  title,
  body,
  cta,
  danger,
  noteLabel,
  notePlaceholder,
  requireNote,
  defaultNote = '',
  pending,
  error,
  successMessage,
  run,
  onClose,
  onDone,
}: {
  icon: string;
  title: string;
  body?: string;
  cta: string;
  danger?: boolean;
  noteLabel?: string;
  notePlaceholder?: string;
  requireNote?: boolean;
  defaultNote?: string;
  pending: boolean;
  error: unknown;
  successMessage: string;
  run: (note: string, onSuccess: () => void) => void;
  onClose: () => void;
  onDone?: () => void;
}) {
  const { t } = useTranslation('admin-components');
  const done = useDone({ onClose, onDone });
  const [note, setNote] = useState(defaultNote);
  return (
    <ModalShell
      icon={icon}
      danger={danger}
      title={title}
      body={body}
      cta={cta}
      pending={pending}
      disabled={!!requireNote && !note.trim()}
      error={error ? errMessage(error) : null}
      onClose={onClose}
      onConfirm={() => run(note.trim(), () => done(successMessage))}
    >
      <TextAreaField label={noteLabel ?? t('am.internalNote')} value={note} onChange={setNote} placeholder={notePlaceholder ?? t('am.adminOnly')} />
    </ModalShell>
  );
}

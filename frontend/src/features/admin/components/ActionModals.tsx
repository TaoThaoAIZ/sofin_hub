import { useState } from 'react';
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

const opt = (labels: readonly string[]) => labels.map((l) => ({ value: l, label: l }));
export const USER_REASONS = opt(['Spam', 'Quấy rối', 'Ngôn từ thù ghét', 'Lừa đảo', 'Bản quyền', 'Nội dung nhạy cảm', 'Khác']);
const COMMUNITY_SUSPEND_REASONS = opt(['Vi phạm chính sách', 'Gian lận', 'Spam', 'Bản quyền', 'Rủi ro thanh toán', 'Khác']);
const COMMUNITY_DELETE_REASONS = opt(['Chủ sở hữu yêu cầu', 'Vi phạm chính sách', 'Gian lận', 'Spam', 'Không hoạt động']);
const COMMUNITY_REJECT_REASONS = opt(['Vi phạm chính sách', 'Nội dung không phù hợp', 'Thông tin gây hiểu lầm', 'Trùng lặp', 'Khác']);
const DURATIONS = (Object.keys(DURATION_LABEL) as DurationKey[]).map((d) => ({ value: d, label: DURATION_LABEL[d] }));
const RESTRICTIONS = (Object.keys(RESTRICTION_LABEL) as RestrictionKey[]).map((k) => ({ value: k, label: RESTRICTION_LABEL[k] }));

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
  const done = useDone({ onClose, onDone });
  const m = useSuspendCommunity();
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState<DurationKey>('7d');
  const [note, setNote] = useState('');
  return (
    <ModalShell
      icon="pause_circle"
      danger
      title={`Tạm ngưng ${community.name}?`}
      body="Thành viên mất quyền truy cập ngay lập tức. Thanh toán và chi trả tạm dừng trong thời gian tạm ngưng."
      cta="Tạm ngưng cộng đồng"
      pending={m.isPending}
      disabled={!reason}
      error={m.isError ? errMessage(m.error) : null}
      onClose={onClose}
      onConfirm={() => m.mutate({ id: community.id, reason, duration, note: note.trim() || undefined }, { onSuccess: () => done(`Đã tạm ngưng · ${community.name}`) })}
    >
      <OptionChips label="Lý do" options={COMMUNITY_SUSPEND_REASONS} value={reason} onChange={(v) => setReason(v as string)} />
      <OptionChips label="Thời hạn" options={DURATIONS} value={duration} onChange={(v) => setDuration(v as DurationKey)} />
      <TextAreaField label="Ghi chú nội bộ" value={note} onChange={setNote} placeholder="Chỉ quản trị viên xem được..." />
    </ModalShell>
  );
}

export function DeleteCommunityModal({ community, onClose, onDone }: { community: CommunityRef } & BaseProps) {
  const done = useDone({ onClose, onDone });
  const m = useDeleteCommunity();
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [word, setWord] = useState('');
  return (
    <ModalShell
      icon="delete_forever"
      danger
      title="Xóa cộng đồng"
      body={`Bạn sắp xóa ${community.name}.`}
      cta="Xóa cộng đồng"
      pending={m.isPending}
      disabled={!reason || word !== 'DELETE'}
      error={m.isError ? errMessage(m.error) : null}
      onClose={onClose}
      onConfirm={() => m.mutate({ id: community.id, reason, note: note.trim() || undefined }, { onSuccess: () => done(`Đã xóa · ${community.name}`) })}
    >
      <WarnBox lines={['Mọi thành viên mất quyền truy cập và các gói đang hoạt động bị hủy.', 'Bài viết, khóa học và sự kiện bị ẩn và lên lịch xóa.', 'Dữ liệu được giữ 30 ngày, sau đó xóa vĩnh viễn.']} />
      <OptionChips label="Lý do" options={COMMUNITY_DELETE_REASONS} value={reason} onChange={(v) => setReason(v as string)} />
      <TextAreaField label="Ghi chú nội bộ" value={note} onChange={setNote} placeholder="Chỉ quản trị viên xem được..." />
      <InputField label="Gõ DELETE để xác nhận" value={word} onChange={setWord} placeholder="DELETE" mono />
    </ModalShell>
  );
}

/** Khôi phục cộng đồng đã xóa (undelete) — hiển thị thông tin xóa nếu có. */
export function UndeleteCommunityModal({ community, info, onClose, onDone }: { community: CommunityRef; info?: [string, string][] } & BaseProps) {
  const done = useDone({ onClose, onDone });
  const m = useUndeleteCommunity();
  return (
    <ModalShell
      icon="restore"
      title={`Khôi phục ${community.name}?`}
      body="Cộng đồng, nội dung và quyền truy cập của thành viên sẽ được khôi phục. Các gói đã hủy không tự kích hoạt lại."
      cta="Khôi phục cộng đồng"
      pending={m.isPending}
      error={m.isError ? errMessage(m.error) : null}
      onClose={onClose}
      onConfirm={() => m.mutate({ id: community.id }, { onSuccess: () => done(`Đã khôi phục · ${community.name}`) })}
    >
      {info && info.length > 0 && <InfoGrid items={info} />}
    </ModalShell>
  );
}

/** Gỡ tạm ngưng (suspended → active). */
export function RestoreCommunityModal({ community, onClose, onDone }: { community: CommunityRef } & BaseProps) {
  const done = useDone({ onClose, onDone });
  const m = useRestoreCommunity();
  const [note, setNote] = useState('');
  return (
    <ModalShell
      icon="restore"
      title={`Khôi phục ${community.name}?`}
      body="Cộng đồng hoạt động trở lại và thành viên truy cập được ngay."
      cta="Khôi phục cộng đồng"
      pending={m.isPending}
      error={m.isError ? errMessage(m.error) : null}
      onClose={onClose}
      onConfirm={() => m.mutate({ id: community.id, note: note.trim() || undefined }, { onSuccess: () => done(`Đã khôi phục · ${community.name}`) })}
    >
      <TextAreaField label="Ghi chú nội bộ" value={note} onChange={setNote} placeholder="Chỉ quản trị viên xem được..." />
    </ModalShell>
  );
}

export function ApproveCommunityModal({ community, onClose, onDone }: { community: CommunityRef } & BaseProps) {
  const done = useDone({ onClose, onDone });
  const m = useApproveCommunity();
  const [note, setNote] = useState('');
  return (
    <ModalShell
      icon="check_circle"
      title={`Duyệt ${community.name}?`}
      body="Cộng đồng sẽ chuyển sang hoạt động và hiển thị trên nền tảng."
      cta="Duyệt cộng đồng"
      pending={m.isPending}
      error={m.isError ? errMessage(m.error) : null}
      onClose={onClose}
      onConfirm={() => m.mutate({ id: community.id, note: note.trim() || undefined }, { onSuccess: () => done(`Đã duyệt · ${community.name}`) })}
    >
      <TextAreaField label="Ghi chú xét duyệt" value={note} onChange={setNote} placeholder="Thêm ghi chú xét duyệt nội bộ..." />
    </ModalShell>
  );
}

const CHANGE_TOPICS = opt(['Hồ sơ cộng đồng', 'Mô tả', 'Giá', 'Chất lượng nội dung', 'Tuân thủ chính sách']);

export function RequestChangesModal({ community, onClose, onDone }: { community: CommunityRef } & BaseProps) {
  const done = useDone({ onClose, onDone });
  const m = useRequestCommunityChanges();
  const [topics, setTopics] = useState<string[]>([]);
  const [msg, setMsg] = useState('');
  const note = [topics.length ? `Cần chỉnh sửa: ${topics.join(', ')}.` : '', msg.trim()].filter(Boolean).join(' ');
  return (
    <ModalShell
      icon="edit_note"
      title={`Yêu cầu chỉnh sửa · ${community.name}`}
      cta="Gửi yêu cầu"
      pending={m.isPending}
      disabled={!note}
      error={m.isError ? errMessage(m.error) : null}
      onClose={onClose}
      onConfirm={() => m.mutate({ id: community.id, note }, { onSuccess: () => done(`Đã yêu cầu chỉnh sửa · ${community.name}`) })}
    >
      <OptionChips label="Cần chỉnh sửa gì" options={CHANGE_TOPICS} value={topics} onChange={(v) => setTopics(v as string[])} multi />
      <TextAreaField label="Tin nhắn gửi chủ sở hữu" value={msg} onChange={setMsg} placeholder="Mô tả các thay đổi cần thực hiện..." maxLength={480} />
    </ModalShell>
  );
}

export function RejectCommunityModal({ community, onClose, onDone }: { community: CommunityRef } & BaseProps) {
  const done = useDone({ onClose, onDone });
  const m = useRejectCommunity();
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  return (
    <ModalShell
      icon="block"
      danger
      title={`Từ chối ${community.name}?`}
      body="Chủ sở hữu sẽ được thông báo về quyết định này."
      cta="Từ chối"
      pending={m.isPending}
      disabled={!reason}
      error={m.isError ? errMessage(m.error) : null}
      onClose={onClose}
      onConfirm={() => m.mutate({ id: community.id, reason, note: note.trim() || undefined }, { onSuccess: () => done(`Đã từ chối · ${community.name}`) })}
    >
      <OptionChips label="Lý do" options={COMMUNITY_REJECT_REASONS} value={reason} onChange={(v) => setReason(v as string)} />
      <TextAreaField label="Ghi chú" value={note} onChange={setNote} placeholder="Chỉ quản trị viên xem được..." />
    </ModalShell>
  );
}

/* ------------------------------ Người dùng ------------------------------ */

/** Đối tượng thao tác: trực tiếp lên user, hoặc thông qua một vụ việc kiểm duyệt (áp lên người bị báo cáo). */
export type UserTarget = { kind: 'user'; userId: string; name: string } | { kind: 'case'; caseId: string; name: string };

export function RestrictUserModal({ target, onClose, onDone }: { target: UserTarget } & BaseProps) {
  const done = useDone({ onClose, onDone });
  const direct = useRestrictUser();
  const viaCase = useRestrictCaseUser();
  const m = target.kind === 'user' ? direct : viaCase;
  const [what, setWhat] = useState<RestrictionKey[]>(['post']);
  const [duration, setDuration] = useState<DurationKey>('7d');
  const [reason, setReason] = useState('');
  const submit = () => {
    const body = { reason, restrictions: what, duration };
    const opts = { onSuccess: () => done(`Đã hạn chế · ${target.name}`) };
    if (target.kind === 'user') direct.mutate({ id: target.userId, ...body }, opts);
    else viaCase.mutate({ id: target.caseId, ...body }, opts);
  };
  return (
    <ModalShell
      icon="block"
      title={`Hạn chế ${target.name}`}
      body="Chọn những việc người dùng không được làm. Họ vẫn đọc được nội dung."
      cta="Hạn chế người dùng"
      pending={m.isPending}
      disabled={!reason || what.length === 0}
      error={m.isError ? errMessage(m.error) : null}
      onClose={onClose}
      onConfirm={submit}
    >
      <OptionChips label="Chọn hạn chế" options={RESTRICTIONS} value={what} onChange={(v) => setWhat(v as RestrictionKey[])} multi />
      <OptionChips label="Thời hạn" options={DURATIONS} value={duration} onChange={(v) => setDuration(v as DurationKey)} />
      <OptionChips label="Lý do" options={USER_REASONS} value={reason} onChange={(v) => setReason(v as string)} />
    </ModalShell>
  );
}

export function SuspendUserModal({ target, defaultNote = '', onClose, onDone }: { target: UserTarget; defaultNote?: string } & BaseProps) {
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
    const opts = { onSuccess: () => done(`Đã tạm ngưng · ${target.name}`) };
    if (target.kind === 'user') direct.mutate({ id: target.userId, ...body }, opts);
    else viaCase.mutate({ id: target.caseId, ...body }, opts);
  };
  return (
    <ModalShell
      icon="pause_circle"
      danger
      title={`Tạm ngưng ${target.name}?`}
      body="Tài khoản không thể đăng nhập trong thời gian tạm ngưng."
      cta="Tạm ngưng người dùng"
      pending={m.isPending}
      disabled={!reason}
      error={m.isError ? errMessage(m.error) : null}
      onClose={onClose}
      onConfirm={submit}
    >
      <OptionChips label="Thời hạn" options={DURATIONS} value={duration} onChange={(v) => setDuration(v as DurationKey)} />
      <OptionChips label="Lý do" options={USER_REASONS} value={reason} onChange={(v) => setReason(v as string)} />
      <TextAreaField label="Ghi chú nội bộ" value={note} onChange={setNote} placeholder="Bằng chứng, link vụ việc..." />
      <CheckField text="Thông báo cho người dùng" checked={notify} onChange={setNotify} />
    </ModalShell>
  );
}

export function BanUserModal({ target, summary, defaultNote = '', onClose, onDone }: { target: UserTarget; summary?: [string, string][]; defaultNote?: string } & BaseProps) {
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
    const opts = { onSuccess: () => done(`Đã cấm · ${target.name}`) };
    if (target.kind === 'user') direct.mutate({ id: target.userId, ...body }, opts);
    else viaCase.mutate({ id: target.caseId, ...body }, opts);
  };
  return (
    <ModalShell
      icon="gavel"
      danger
      title={`Cấm vĩnh viễn ${target.name}?`}
      body="Người dùng bị chặn đăng nhập. Bạn có thể khôi phục lại sau bằng thao tác “Khôi phục”."
      cta="Cấm vĩnh viễn"
      pending={m.isPending}
      disabled={!reason || word !== 'BAN'}
      error={m.isError ? errMessage(m.error) : null}
      onClose={onClose}
      onConfirm={submit}
    >
      {summary && summary.length > 0 && <InfoGrid items={summary} />}
      <OptionChips label="Lý do" options={USER_REASONS} value={reason} onChange={(v) => setReason(v as string)} />
      <TextAreaField label="Bằng chứng" value={evidence} onChange={setEvidence} placeholder="Link vụ việc, ảnh chụp màn hình..." />
      <TextAreaField label="Ghi chú nội bộ" value={note} onChange={setNote} placeholder="Chỉ quản trị viên xem được..." />
      <InputField label="Gõ BAN để xác nhận" value={word} onChange={setWord} placeholder="BAN" mono />
    </ModalShell>
  );
}

/** Khôi phục tài khoản (restricted/suspended/banned → active). */
export function ReinstateUserModal({ user, onClose, onDone }: { user: { id: string; name: string } } & BaseProps) {
  const done = useDone({ onClose, onDone });
  const m = useReinstateUser();
  const [note, setNote] = useState('');
  return (
    <ModalShell
      icon="restart_alt"
      title={`Khôi phục ${user.name}?`}
      body="Tài khoản trở lại trạng thái hoạt động, mọi hạn chế/tạm ngưng/cấm được gỡ."
      cta="Khôi phục truy cập"
      pending={m.isPending}
      error={m.isError ? errMessage(m.error) : null}
      onClose={onClose}
      onConfirm={() => m.mutate({ id: user.id, note: note.trim() || undefined }, { onSuccess: () => done(`Đã khôi phục · ${user.name}`) })}
    >
      <TextAreaField label="Ghi chú nội bộ" value={note} onChange={setNote} placeholder="Chỉ quản trị viên xem được..." />
    </ModalShell>
  );
}

/** Cảnh cáo: trực tiếp lên user (kèm tin nhắn) hoặc từ vụ việc (đóng vụ việc nếu closeCase). */
export function WarnModal({ target, onClose, onDone }: { target: UserTarget } & BaseProps) {
  const done = useDone({ onClose, onDone });
  const direct = useWarnUser();
  const viaCase = useWarnCase();
  const m = target.kind === 'user' ? direct : viaCase;
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const submit = () => {
    const opts = { onSuccess: () => done(`Đã gửi cảnh cáo · ${target.name}`) };
    if (target.kind === 'user') direct.mutate({ id: target.userId, reason, message: message.trim() }, opts);
    else viaCase.mutate({ id: target.caseId, reason, message: message.trim(), closeCase: true }, opts);
  };
  return (
    <ModalShell
      icon="warning"
      title="Gửi cảnh cáo"
      body={`Đến ${target.name}`}
      cta="Gửi cảnh cáo"
      pending={m.isPending}
      disabled={!reason || !message.trim()}
      error={m.isError ? errMessage(m.error) : null}
      onClose={onClose}
      onConfirm={submit}
    >
      <OptionChips label="Vi phạm" options={USER_REASONS} value={reason} onChange={(v) => setReason(v as string)} />
      <TextAreaField label="Tin nhắn gửi người dùng" value={message} onChange={setMessage} placeholder="Giải thích quy định bị vi phạm và hậu quả tiếp theo..." />
    </ModalShell>
  );
}

export function RemoveContentModal({ caseId, title, onClose, onDone }: { caseId: string; title: string } & BaseProps) {
  const done = useDone({ onClose, onDone });
  const m = useRemoveCaseContent();
  const [reason, setReason] = useState('');
  const [notifyAuthor, setNotifyAuthor] = useState(true);
  return (
    <ModalShell
      icon="delete"
      danger
      title="Gỡ nội dung"
      body={title}
      cta="Gỡ nội dung"
      pending={m.isPending}
      disabled={!reason}
      error={m.isError ? errMessage(m.error) : null}
      onClose={onClose}
      onConfirm={() => m.mutate({ id: caseId, reason, notifyAuthor }, { onSuccess: () => done('Đã gỡ nội dung') })}
    >
      <OptionChips label="Vi phạm" options={USER_REASONS} value={reason} onChange={(v) => setReason(v as string)} />
      <CheckField text="Thông báo cho tác giả" checked={notifyAuthor} onChange={setNotifyAuthor} />
    </ModalShell>
  );
}

/** Tóm tắt trước khi cấm (từ UserDetail/AdminUser). */
export const banSummary = (u: { communities: number; revenueCents: number; reports: number; plan?: string }): [string, string][] => [
  ['Cộng đồng', String(u.communities)],
  ['Gói trả phí', u.plan === 'paid' ? 'Có' : 'Không'],
  ['Doanh thu', formatCents(u.revenueCents)],
  ['Báo cáo hiện có', String(u.reports)],
];

export const trashInfo = (t: { deletedBy: { name: string } | null; deletedByOwner: boolean; deletedAt: string; reason: string | null; purgeAt: string }): [string, string][] => [
  ['Xóa bởi', t.deletedByOwner ? 'Chủ sở hữu' : (t.deletedBy?.name ?? '—')],
  ['Ngày xóa', formatDate(t.deletedAt)],
  ['Lý do', t.reason ?? '—'],
  ['Hạn lưu dữ liệu', formatDate(t.purgeAt)],
];

/** Modal xác nhận kèm ô ghi chú (bỏ qua vụ việc, đóng vụ việc, nâng mức rủi ro...). `run` gọi mutation tương ứng. */
export function NoteModal({
  icon,
  title,
  body,
  cta,
  danger,
  noteLabel = 'Ghi chú nội bộ',
  notePlaceholder = 'Chỉ quản trị viên xem được...',
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
      <TextAreaField label={noteLabel} value={note} onChange={setNote} placeholder={notePlaceholder} />
    </ModalShell>
  );
}

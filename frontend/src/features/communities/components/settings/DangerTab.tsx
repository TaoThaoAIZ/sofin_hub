import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { MaterialIcon } from '../../../../components/ui/MaterialIcon';
import { useAuth } from '../../../auth/AuthContext';
import { useMembers } from '../../../community/queries';
import type { CommunityDetail } from '../../../courses/types';
import { useDeleteCommunity, useLockCommunity, useTransferOwnership } from '../../queries';
import { ROLE_RANK, type ViewerRole } from '../../types';
import { CancelButton, ErrorLine, errorText, INPUT_CLASS, Modal, PrimaryButton } from '../Modal';

function Zone({ title, desc, children }: { title: string; desc: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50/40 p-4">
      <div className="text-[15px] font-bold text-red-700">{title}</div>
      <p className="mt-1 text-sm text-stone-600">{desc}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

const dangerBtn = 'h-10 rounded-xl border border-red-300 bg-white px-5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50';

export function DangerTab({ course, viewerRole }: { course: CommunityDetail; viewerRole: ViewerRole }) {
  const isOwner = ROLE_RANK[viewerRole] >= ROLE_RANK.owner;
  const isPlatformAdmin = viewerRole === 'platform_admin';
  return (
    <section className="glass flex flex-col gap-4 rounded-[26px] p-6">
      <h2 className="m-0 text-lg font-extrabold text-red-700">Vùng nguy hiểm</h2>
      {isOwner && <TransferZone course={course} />}
      {isOwner && <DeleteZone course={course} />}
      {isPlatformAdmin && <LockZone course={course} />}
    </section>
  );
}

function TransferZone({ course }: { course: CommunityDetail }) {
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [target, setTarget] = useState<{ id: string; name: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);
  const members = useMembers(course.id, { q: q || undefined });
  const transfer = useTransferOwnership(course.id);

  // Chỉ thành viên thật (không phải minh họa), không phải chính mình / chủ hiện tại.
  const candidates = (members.data?.data ?? []).filter((m) => !m.id.startsWith('seed:') && m.id !== user?.id && m.roleDetail !== 'owner');

  return (
    <Zone title="Chuyển quyền chủ cộng đồng" desc="Người nhận trở thành chủ cộng đồng; bạn sẽ trở thành quản trị viên. Bạn không thể tự hoàn tác.">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm thành viên theo tên…" className={INPUT_CLASS} />
      <div className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-[rgba(120,60,20,.1)] bg-white">
        {members.isPending && <p className="p-3 text-sm text-stone-500">Đang tải…</p>}
        {members.data && candidates.length === 0 && <p className="p-3 text-sm text-stone-500">Không có thành viên phù hợp để nhận quyền.</p>}
        {candidates.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setTarget({ id: m.id, name: m.name })}
            className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-stone-50 ${target?.id === m.id ? 'bg-brand-soft font-semibold text-brand' : ''}`}
          >
            <span className="truncate">{m.name}</span>
            <span className="ml-2 text-xs text-stone-500">@{m.handle}</span>
          </button>
        ))}
      </div>
      <button type="button" disabled={!target || transfer.isPending} onClick={() => setConfirming(true)} className={`${dangerBtn} mt-3`}>
        {target ? `Chuyển quyền cho ${target.name}` : 'Chọn một thành viên'}
      </button>
      {done && <p className="mt-2 text-sm text-green-700">Đã chuyển quyền chủ cộng đồng.</p>}
      {transfer.isError && !confirming && <ErrorLine>{errorText(transfer.error)}</ErrorLine>}

      {confirming && target && (
        <Modal
          title="Xác nhận chuyển quyền"
          icon="swap_horiz"
          onClose={() => setConfirming(false)}
          footer={
            <>
              <CancelButton onClick={() => setConfirming(false)} />
              <PrimaryButton
                danger
                disabled={transfer.isPending}
                onClick={() =>
                  transfer.mutate(target.id, {
                    onSuccess: () => {
                      setDone(true);
                      setTarget(null);
                      setConfirming(false);
                    },
                    onError: () => setConfirming(false),
                  })
                }
              >
                {transfer.isPending ? 'Đang chuyển…' : 'Chuyển quyền'}
              </PrimaryButton>
            </>
          }
        >
          Chuyển quyền chủ "{course.title}" cho <b>{target.name}</b>? Bạn sẽ trở thành quản trị viên và mất quyền đổi giá, xóa cộng đồng.
        </Modal>
      )}
    </Zone>
  );
}

function DeleteZone({ course }: { course: CommunityDetail }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const del = useDeleteCommunity(course.id);
  const matches = typed.trim() === course.title.trim();

  return (
    <Zone title="Xóa cộng đồng" desc="Cộng đồng sẽ bị ẩn khỏi nền tảng và mọi thành viên được thông báo. Hành động này không thể hoàn tác.">
      <button type="button" onClick={() => setOpen(true)} className={dangerBtn}>
        Xóa cộng đồng
      </button>
      {open && (
        <Modal
          title="Xóa cộng đồng"
          icon="delete_forever"
          onClose={() => setOpen(false)}
          footer={
            <>
              <CancelButton onClick={() => setOpen(false)} />
              <PrimaryButton danger disabled={!matches || del.isPending} onClick={() => del.mutate(undefined, { onSuccess: () => navigate('/', { replace: true }) })}>
                {del.isPending ? 'Đang xóa…' : 'Xóa vĩnh viễn'}
              </PrimaryButton>
            </>
          }
        >
          Để xác nhận, hãy nhập chính xác tên cộng đồng: <b className="break-words">{course.title}</b>
          <input value={typed} onChange={(e) => setTyped(e.target.value)} className={`${INPUT_CLASS} mt-3`} aria-label="Nhập tên cộng đồng để xác nhận" />
          {del.isError && <ErrorLine>{errorText(del.error)}</ErrorLine>}
        </Modal>
      )}
    </Zone>
  );
}

function LockZone({ course }: { course: CommunityDetail }) {
  const [reason, setReason] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const lock = useLockCommunity(course.id);
  const locked = !!course.locked;

  return (
    <Zone
      title={locked ? 'Cộng đồng đang bị khóa' : 'Khóa cộng đồng (Quản trị nền tảng)'}
      desc={
        locked
          ? 'Thành viên không thể truy cập nội dung. Mở khóa để cộng đồng hoạt động lại.'
          : 'Khóa sẽ ẩn cộng đồng khỏi danh sách và chặn thành viên truy cập. Chủ cộng đồng được thông báo kèm lý do.'
      }
    >
      {locked ? (
        <button type="button" disabled={lock.isPending} onClick={() => lock.mutate({ lock: false })} className={dangerBtn}>
          <MaterialIcon name="lock_open" size={16} color="#dc2626" className="mr-1.5 align-middle" />
          {lock.isPending ? 'Đang mở khóa…' : 'Mở khóa cộng đồng'}
        </button>
      ) : (
        <>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={2} placeholder="Lý do khóa (bắt buộc)" className={`${INPUT_CLASS} resize-none`} />
          <button
            type="button"
            disabled={lock.isPending}
            onClick={() => {
              if (!reason.trim()) return setLocalError('Vui lòng nhập lý do khóa');
              setLocalError(null);
              lock.mutate({ lock: true, reason: reason.trim() }, { onSuccess: () => setReason('') });
            }}
            className={`${dangerBtn} mt-2`}
          >
            {lock.isPending ? 'Đang khóa…' : 'Khóa cộng đồng'}
          </button>
        </>
      )}
      {localError && <ErrorLine>{localError}</ErrorLine>}
      {lock.isError && <ErrorLine>{errorText(lock.error)}</ErrorLine>}
    </Zone>
  );
}

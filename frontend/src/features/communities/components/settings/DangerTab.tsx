import { useState, type ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('communities');
  const isOwner = ROLE_RANK[viewerRole] >= ROLE_RANK.owner;
  const isPlatformAdmin = viewerRole === 'platform_admin';
  return (
    <section className="glass flex flex-col gap-4 rounded-[26px] p-6">
      <h2 className="m-0 text-lg font-extrabold text-red-700">{t('danger.title')}</h2>
      {isOwner && <TransferZone course={course} />}
      {isOwner && <DeleteZone course={course} />}
      {isPlatformAdmin && <LockZone course={course} />}
    </section>
  );
}

function TransferZone({ course }: { course: CommunityDetail }) {
  const { t } = useTranslation('communities');
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
    <Zone title={t('danger.transfer.title')} desc={t('danger.transfer.desc')}>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('danger.transfer.searchPlaceholder')} className={INPUT_CLASS} />
      <div className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-[rgba(120,60,20,.1)] bg-white">
        {members.isPending && <p className="p-3 text-sm text-stone-500">{t('danger.transfer.loading')}</p>}
        {members.data && candidates.length === 0 && <p className="p-3 text-sm text-stone-500">{t('danger.transfer.noCandidates')}</p>}
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
        {target ? t('danger.transfer.toName', { name: target.name }) : t('danger.transfer.pick')}
      </button>
      {done && <p className="mt-2 text-sm text-green-700">{t('danger.transfer.done')}</p>}
      {transfer.isError && !confirming && <ErrorLine>{errorText(transfer.error)}</ErrorLine>}

      {confirming && target && (
        <Modal
          title={t('danger.transfer.confirmTitle')}
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
                {transfer.isPending ? t('danger.transfer.transferring') : t('danger.transfer.confirm')}
              </PrimaryButton>
            </>
          }
        >
          <Trans ns="communities" i18nKey="danger.transfer.confirmBody" values={{ title: course.title, name: target.name }} components={{ b: <b /> }} />
        </Modal>
      )}
    </Zone>
  );
}

function DeleteZone({ course }: { course: CommunityDetail }) {
  const { t } = useTranslation('communities');
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const del = useDeleteCommunity(course.id);
  const matches = typed.trim() === course.title.trim();

  return (
    <Zone title={t('danger.delete.title')} desc={t('danger.delete.desc')}>
      <button type="button" onClick={() => setOpen(true)} className={dangerBtn}>
        {t('danger.delete.title')}
      </button>
      {open && (
        <Modal
          title={t('danger.delete.title')}
          icon="delete_forever"
          onClose={() => setOpen(false)}
          footer={
            <>
              <CancelButton onClick={() => setOpen(false)} />
              <PrimaryButton danger disabled={!matches || del.isPending} onClick={() => del.mutate(undefined, { onSuccess: () => navigate('/', { replace: true }) })}>
                {del.isPending ? t('danger.delete.deleting') : t('danger.delete.confirm')}
              </PrimaryButton>
            </>
          }
        >
          <Trans ns="communities" i18nKey="danger.delete.typeName" values={{ title: course.title }} components={{ b: <b className="break-words" /> }} />
          <input value={typed} onChange={(e) => setTyped(e.target.value)} className={`${INPUT_CLASS} mt-3`} aria-label={t('danger.delete.typeNameAria')} />
          {del.isError && <ErrorLine>{errorText(del.error)}</ErrorLine>}
        </Modal>
      )}
    </Zone>
  );
}

function LockZone({ course }: { course: CommunityDetail }) {
  const { t } = useTranslation('communities');
  const [reason, setReason] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const lock = useLockCommunity(course.id);
  const locked = !!course.locked;

  return (
    <Zone
      title={locked ? t('danger.lock.lockedTitle') : t('danger.lock.lockTitle')}
      desc={
        locked
          ? t('danger.lock.lockedDesc')
          : t('danger.lock.lockDesc')
      }
    >
      {locked ? (
        <button type="button" disabled={lock.isPending} onClick={() => lock.mutate({ lock: false })} className={dangerBtn}>
          <MaterialIcon name="lock_open" size={16} color="#dc2626" className="mr-1.5 align-middle" />
          {lock.isPending ? t('danger.lock.unlocking') : t('danger.lock.unlock')}
        </button>
      ) : (
        <>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={2} placeholder={t('danger.lock.reasonPlaceholder')} className={`${INPUT_CLASS} resize-none`} />
          <button
            type="button"
            disabled={lock.isPending}
            onClick={() => {
              if (!reason.trim()) return setLocalError(t('danger.lock.reasonRequired'));
              setLocalError(null);
              lock.mutate({ lock: true, reason: reason.trim() }, { onSuccess: () => setReason('') });
            }}
            className={`${dangerBtn} mt-2`}
          >
            {lock.isPending ? t('danger.lock.locking') : t('danger.lock.lock')}
          </button>
        </>
      )}
      {localError && <ErrorLine>{localError}</ErrorLine>}
      {lock.isError && <ErrorLine>{errorText(lock.error)}</ErrorLine>}
    </Zone>
  );
}

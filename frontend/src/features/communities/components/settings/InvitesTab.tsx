import { useState } from 'react';
import { Button } from '../../../../components/ui/Button';
import { MaterialIcon } from '../../../../components/ui/MaterialIcon';
import { useCreateInvite, useInvites, useRevokeInvite } from '../../queries';
import type { Invite } from '../../types';
import { ErrorLine, errorText, INPUT_CLASS } from '../Modal';
import { usePopup } from '../../../../components/ui/usePopup';

const inviteLink = (code: string) => `${window.location.origin}/invite/${code}`;

function inviteState(i: Invite): { label: string; active: boolean } {
  if (i.revokedAt) return { label: 'Đã thu hồi', active: false };
  if (i.expiresAt && new Date(i.expiresAt).getTime() <= Date.now()) return { label: 'Đã hết hạn', active: false };
  if (i.maxUses !== null && i.usedCount >= i.maxUses) return { label: 'Hết lượt', active: false };
  return { label: 'Đang hoạt động', active: true };
}

export function InvitesTab({ courseId }: { courseId: string }) {
  const { confirm } = usePopup();
  const list = useInvites(courseId, true);
  const create = useCreateInvite(courseId);
  const revoke = useRevokeInvite(courseId);
  const [maxUses, setMaxUses] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const submit = () => {
    const input: { maxUses?: number; expiresAt?: string } = {};
    if (maxUses.trim()) {
      const n = Number(maxUses);
      if (!Number.isInteger(n) || n < 1 || n > 100000) return setFormError('Số lượt dùng phải là số nguyên từ 1 đến 100.000');
      input.maxUses = n;
    }
    if (expiresAt) {
      const d = new Date(expiresAt);
      if (Number.isNaN(d.getTime()) || d.getTime() <= Date.now()) return setFormError('Hạn dùng phải ở tương lai');
      input.expiresAt = d.toISOString();
    }
    setFormError(null);
    create.mutate(input, {
      onSuccess: () => {
        setMaxUses('');
        setExpiresAt('');
      },
    });
  };

  const copy = (code: string) => {
    void navigator.clipboard?.writeText(inviteLink(code));
    setCopied(code);
    setTimeout(() => setCopied((c) => (c === code ? null : c)), 1800);
  };

  return (
    <section className="glass flex flex-col gap-5 rounded-[26px] p-6">
      <h2 className="m-0 text-lg font-extrabold">Lời mời</h2>

      <div className="rounded-2xl border border-[rgba(120,60,20,.1)] bg-white/60 p-4">
        <div className="text-[15px] font-bold">Tạo liên kết mời mới</div>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="block text-[13px] font-semibold text-stone-700">
            Số lượt dùng tối đa (bỏ trống = không giới hạn)
            <input value={maxUses} onChange={(e) => setMaxUses(e.target.value)} inputMode="numeric" placeholder="Ví dụ: 20" className={`${INPUT_CLASS} mt-1.5 font-normal`} />
          </label>
          <label className="block text-[13px] font-semibold text-stone-700">
            Hết hạn lúc (bỏ trống = vô thời hạn)
            <input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className={`${INPUT_CLASS} mt-1.5 font-normal`} />
          </label>
        </div>
        {formError && <ErrorLine>{formError}</ErrorLine>}
        {create.isError && <ErrorLine>{errorText(create.error)}</ErrorLine>}
        <Button onClick={submit} disabled={create.isPending} className="mt-4 h-10 rounded-xl px-5 text-sm font-bold">
          {create.isPending ? 'Đang tạo…' : 'Tạo lời mời'}
        </Button>
      </div>

      {list.isPending && <p className="text-sm text-stone-500">Đang tải lời mời…</p>}
      {list.isError && <p className="text-sm text-red-600">{errorText(list.error)}</p>}
      {list.data?.length === 0 && <p className="py-2 text-center text-sm text-stone-500">Chưa có lời mời nào.</p>}
      {revoke.isError && <p className="text-sm font-medium text-red-600">{errorText(revoke.error)}</p>}

      <div className="flex flex-col gap-3">
        {list.data?.map((i) => {
          const st = inviteState(i);
          return (
            <div key={i.code} className="rounded-2xl border border-white/95 bg-white/75 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 rounded-lg bg-stone-900/5 px-2.5 py-1.5 text-[12.5px] break-all">{inviteLink(i.code)}</code>
                <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${st.active ? 'bg-green-500/10 text-green-700' : 'bg-stone-900/5 text-stone-600'}`}>{st.label}</span>
              </div>
              <div className="mt-2 text-xs text-stone-500">
                Đã dùng {i.usedCount}
                {i.maxUses !== null ? `/${i.maxUses}` : ''} lượt · {i.expiresAt ? `hết hạn ${new Date(i.expiresAt).toLocaleString('vi-VN')}` : 'không hết hạn'} · tạo{' '}
                {new Date(i.createdAt).toLocaleDateString('vi-VN')}
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => copy(i.code)}
                  className="flex h-9 items-center gap-1.5 rounded-lg border border-[rgba(120,60,20,.15)] bg-white px-3 text-[13px] font-semibold"
                >
                  <MaterialIcon name={copied === i.code ? 'check' : 'content_copy'} size={16} color={copied === i.code ? '#16a34a' : '#1c1917'} />
                  {copied === i.code ? 'Đã sao chép' : 'Sao chép link'}
                </button>
                {!i.revokedAt && (
                  <button
                    type="button"
                    disabled={revoke.isPending}
                    onClick={async () => {
                      if (await confirm({ title: 'Thu hồi lời mời này?', message: 'Liên kết sẽ không dùng được nữa.', tone: 'danger', confirmText: 'Thu hồi' }))
                        revoke.mutate(i.code);
                    }}
                    className="h-9 rounded-lg border border-red-200 px-3 text-[13px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    Thu hồi
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

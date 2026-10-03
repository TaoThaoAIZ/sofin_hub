import { useState } from 'react';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { ApiError } from '../../../lib/api';
import { ROLE_LABEL } from '../../account/roles';
import { useToast } from '../../admin/components/overlay';
import type { EmailDigest } from '../../notifications/types';
import { COMMUNITY_COLUMNS, type CommunityPref, type NotifySettings } from '../notify/api';
import { useNotifySettings, useSaveNotifySettings } from '../notify/queries';
import { CommunityLogo, PRIMARY_BTN, SCard, SHead, Toggle } from '../ui';

const DIGESTS: readonly { value: EmailDigest; label: string }[] = [
  { value: 'instant', label: 'Ngay lập tức' },
  { value: 'daily', label: 'Mỗi ngày' },
  { value: 'weekly', label: 'Mỗi tuần' },
  { value: 'off', label: 'Tắt' },
];

const DM_ROWS = [
  { key: 'dmAllowed', icon: 'sms', title: 'Cho phép nhắn tin riêng', sub: 'Tất cả thành viên có thể nhắn tin cho bạn.' },
  { key: 'emailUnreadDm', icon: 'mark_email_unread', title: 'Email khi có tin nhắn chưa đọc', sub: 'Nhận email khi có tin nhắn mới.' },
  { key: 'notifyFollowedPosts', icon: 'notifications', title: 'Báo khi người tôi theo dõi đăng bài', sub: 'Nhận thông báo khi có người bạn theo dõi đăng bài.' },
] as const;

const ALL_ON: CommunityPref = { admin: true, event: true, featured: true, comment: true, joinRequest: true };
const GRID = 'minmax(220px,1.8fr) repeat(5,minmax(100px,1fr))';

interface Draft {
  emailDigest: EmailDigest;
  quiet: NotifySettings['quiet'];
  dmAllowed: boolean;
  emailUnreadDm: boolean;
  notifyFollowedPosts: boolean;
  prefs: Record<string, CommunityPref>;
}

const toDraft = (s: NotifySettings): Draft => ({
  emailDigest: s.emailDigest,
  quiet: { ...s.quiet },
  dmAllowed: s.dmAllowed,
  emailUnreadDm: s.emailUnreadDm,
  notifyFollowedPosts: s.notifyFollowedPosts,
  prefs: Object.fromEntries(s.communities.map((c) => [c.id, { ...c.prefs }])),
});

const TIME_INPUT = 'h-[34px] rounded-[9px] border-[1.5px] border-[#e7e0da] px-2 text-sm font-semibold outline-0 focus:border-[#fdba74]';

export function NotifyTab() {
  const q = useNotifySettings();
  return (
    <main className="flex min-w-0 flex-col gap-[18px]">
      <div>
        <h1 className="mt-1 text-4xl font-extrabold tracking-[-.03em]">Cài đặt</h1>
        <p className="mt-1.5 text-[15.5px] text-stone-600">Tùy chỉnh cách bạn nhận thông báo và quản lý hoạt động trong cộng đồng.</p>
      </div>
      {q.isPending && <SCard className="text-stone-500">Đang tải cài đặt thông báo…</SCard>}
      {q.isError && (
        <SCard>
          <p role="alert" className="m-0 font-medium text-red-600">
            {q.error instanceof ApiError ? q.error.message : 'Không tải được cài đặt, vui lòng thử lại.'}
          </p>
        </SCard>
      )}
      {q.data && <NotifyForm data={q.data} />}
    </main>
  );
}

function NotifyForm({ data }: { data: NotifySettings }) {
  const toast = useToast();
  const save = useSaveNotifySettings();
  const saved = toDraft(data);
  const [draft, setDraft] = useState<Draft>(saved);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  const setCell = (id: string, key: keyof CommunityPref, v: boolean) =>
    setDraft((d) => ({ ...d, prefs: { ...d.prefs, [id]: { ...(d.prefs[id] ?? ALL_ON), [key]: v } } }));

  const onSave = () => {
    // Chỉ gửi cộng đồng có cột bị tắt: đặt lại mặc định => {} (BE coi thiếu = bật hết).
    const communityPrefs = Object.fromEntries(Object.entries(draft.prefs).filter(([, p]) => Object.values(p).some((v) => !v)));
    save.mutate(
      { emailDigest: draft.emailDigest, quiet: draft.quiet, dmAllowed: draft.dmAllowed, emailUnreadDm: draft.emailUnreadDm, notifyFollowedPosts: draft.notifyFollowedPosts, communityPrefs },
      {
        onSuccess: () => toast.success('Đã lưu cài đặt thông báo'),
        onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Không lưu được, vui lòng thử lại.'),
      },
    );
  };

  return (
    <>
      <div className="grid items-stretch gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(min(340px,100%),1fr))]">
        <SCard>
          <SHead icon="mail" title="Email tổng hợp" sub="Gom mọi hoạt động thành một email thay vì nhiều email lẻ." />
          <div role="tablist" aria-label="Email tổng hợp" className="mt-[18px] grid grid-cols-4 rounded-[14px] bg-[#f5f2ef] p-1">
            {DIGESTS.map((d) => {
              const on = draft.emailDigest === d.value;
              return (
                <button
                  key={d.value}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => patch({ emailDigest: d.value })}
                  className={`flex h-11 items-center justify-center rounded-[11px] border-[1.5px] text-[14.5px] font-semibold whitespace-nowrap ${
                    on ? 'border-[#fdba74] bg-white text-brand' : 'border-transparent bg-transparent text-stone-600'
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
          {(draft.emailDigest === 'daily' || draft.emailDigest === 'weekly') && (
            <p className="mt-2.5 mb-0 text-[12.5px] text-stone-500">Lựa chọn này được lưu; email tổng hợp định kỳ chưa được gửi tự động. Chọn “Ngay lập tức” để nhận email mỗi khi có thông báo.</p>
          )}
          <div className="mt-[18px] flex gap-3.5 border-t border-[#f1ebe6] pt-[18px]">
            <span className="grid size-[38px] flex-none place-items-center rounded-full bg-[#fff1e6]">
              <MaterialIcon name="bedtime" size={20} filled color="#f26a1b" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-bold">Giờ im lặng</div>
              <div className="mt-0.5 text-[13.5px] text-stone-500">Không gửi thông báo trong khoảng thời gian này.</div>
              {draft.quiet.enabled && (
                <div className="mt-3 flex items-center gap-2 text-[15px] font-semibold">
                  <input type="time" aria-label="Từ giờ" value={draft.quiet.from} onChange={(e) => patch({ quiet: { ...draft.quiet, from: e.target.value } })} className={TIME_INPUT} />–
                  <input type="time" aria-label="Đến giờ" value={draft.quiet.to} onChange={(e) => patch({ quiet: { ...draft.quiet, to: e.target.value } })} className={TIME_INPUT} />
                </div>
              )}
            </div>
            <Toggle small label="Giờ im lặng" on={draft.quiet.enabled} onChange={(v) => patch({ quiet: { ...draft.quiet, enabled: v } })} />
          </div>
        </SCard>

        <SCard>
          <SHead icon="chat" title="Tin nhắn & người theo dõi" sub="Áp dụng cho mọi cộng đồng." className="mb-1.5" />
          {DM_ROWS.map((m) => (
            <div key={m.key} className="flex items-center gap-3.5 border-t border-[#f1ebe6] py-3.5">
              <span className="grid size-[38px] flex-none place-items-center rounded-full bg-[#fff1e6]">
                <MaterialIcon name={m.icon} size={20} color="#f26a1b" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-bold">{m.title}</div>
                <div className="mt-0.5 text-[13px] text-stone-500">{m.sub}</div>
              </div>
              <Toggle small label={m.title} on={draft[m.key]} onChange={(v) => patch({ [m.key]: v })} />
            </div>
          ))}
        </SCard>
      </div>

      <SCard>
        <SHead
          icon="groups"
          title="Theo từng cộng đồng"
          sub="Tắt những gì bạn không cần ở từng nơi."
          action={
            <button
              type="button"
              onClick={() => setDraft((d) => ({ ...d, prefs: Object.fromEntries(Object.keys(d.prefs).map((id) => [id, { ...ALL_ON }])) }))}
              className="flex h-[42px] items-center gap-1.5 rounded-xl border-[1.5px] border-[#fdba74] bg-white px-4 text-[13.5px] font-bold text-brand"
            >
              <MaterialIcon name="refresh" size={19} />
              Đặt lại mặc định
            </button>
          }
        />
        <div className="mt-[18px] overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="grid items-center gap-2.5 rounded-xl bg-[#f7f4f1] px-4 py-3 text-[13px] font-semibold text-stone-600" style={{ gridTemplateColumns: GRID }}>
              <span>Cộng đồng</span>
              {COMMUNITY_COLUMNS.map((c) => (
                <span key={c.key} className="text-center">
                  {c.label}
                </span>
              ))}
            </div>
            {data.communities.length === 0 && <div className="px-2.5 py-8 text-center text-sm text-stone-500">Bạn chưa tham gia cộng đồng nào.</div>}
            {data.communities.map((c) => (
              <div key={c.id} className="grid items-center gap-2.5 border-b border-[#f1ebe6] px-4 py-3.5" style={{ gridTemplateColumns: GRID }}>
                <div className="flex min-w-0 items-center gap-3.5">
                  <CommunityLogo name={c.title} seed={c.id} size={44} src={c.logoUrl} />
                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-bold">{c.title}</div>
                    <div className="text-[13px] text-stone-500">{ROLE_LABEL[c.role]}</div>
                  </div>
                </div>
                {COMMUNITY_COLUMNS.map((col) => (
                  <div key={col.key} className="flex justify-center">
                    {c.applicable[col.key] ? (
                      <Toggle small label={`${col.label} · ${c.title}`} on={(draft.prefs[c.id] ?? ALL_ON)[col.key]} onChange={(v) => setCell(c.id, col.key, v)} />
                    ) : (
                      <span className="text-[#c7bfb8]" aria-label="Không áp dụng">
                        –
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </SCard>

      <div className="flex justify-end gap-3.5">
        <button
          type="button"
          disabled={!dirty || save.isPending}
          onClick={() => setDraft(toDraft(data))}
          className="h-[54px] rounded-xl border-[1.5px] border-[#e7e0da] bg-white px-[30px] text-[15px] font-bold disabled:opacity-50"
        >
          Hủy
        </button>
        <button type="button" disabled={!dirty || save.isPending} onClick={onSave} className={`${PRIMARY_BTN} h-[54px] px-[30px] text-[15.5px]`}>
          {save.isPending ? 'Đang lưu…' : 'Lưu thay đổi'}
          <MaterialIcon name="arrow_forward" size={20} />
        </button>
      </div>
    </>
  );
}

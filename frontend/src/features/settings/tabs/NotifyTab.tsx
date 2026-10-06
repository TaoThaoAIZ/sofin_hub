import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { ApiError } from '../../../lib/api';
import { roleLabel } from '../../account/roles';
import { useToast } from '../../admin/components/overlay';
import type { EmailDigest } from '../../notifications/types';
import { COMMUNITY_COLUMNS, type CommunityPref, type NotifySettings } from '../notify/api';
import { useNotifySettings, useSaveNotifySettings } from '../notify/queries';
import { CommunityLogo, PRIMARY_BTN, SCard, SHead, Toggle } from '../ui';

const DIGESTS: readonly { value: EmailDigest; label: string }[] = [
  { value: 'instant', label: 'notifyTab.digestInstant' },
  { value: 'daily', label: 'notifyTab.digestDaily' },
  { value: 'weekly', label: 'notifyTab.digestWeekly' },
  { value: 'off', label: 'notifyTab.digestOff' },
];

const DM_ROWS = [
  { key: 'dmAllowed', icon: 'sms', title: 'notifyTab.dmAllowedTitle', sub: 'notifyTab.dmAllowedSub' },
  { key: 'emailUnreadDm', icon: 'mark_email_unread', title: 'notifyTab.emailUnreadTitle', sub: 'notifyTab.emailUnreadSub' },
  { key: 'notifyFollowedPosts', icon: 'notifications', title: 'notifyTab.followedTitle', sub: 'notifyTab.followedSub' },
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
  const { t } = useTranslation('settings');
  const q = useNotifySettings();
  return (
    <main className="flex min-w-0 flex-col gap-[18px]">
      <div>
        <h1 className="mt-1 text-4xl font-extrabold tracking-[-.03em]">{t('notifyTab.title')}</h1>
        <p className="mt-1.5 text-[15.5px] text-stone-600">{t('notifyTab.subtitle')}</p>
      </div>
      {q.isPending && <SCard className="text-stone-500">{t('notifyTab.loading')}</SCard>}
      {q.isError && (
        <SCard>
          <p role="alert" className="m-0 font-medium text-red-600">
            {q.error instanceof ApiError ? q.error.message : t('notifyTab.loadFail')}
          </p>
        </SCard>
      )}
      {q.data && <NotifyForm data={q.data} />}
    </main>
  );
}

function NotifyForm({ data }: { data: NotifySettings }) {
  const { t } = useTranslation('settings');
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
        onSuccess: () => toast.success(t('notifyTab.savedToast')),
        onError: (e) => toast.error(e instanceof ApiError ? e.message : t('notifyTab.saveFail')),
      },
    );
  };

  return (
    <>
      <div className="grid items-stretch gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(min(340px,100%),1fr))]">
        <SCard>
          <SHead icon="mail" title={t('notifyTab.digestTitle')} sub={t('notifyTab.digestSub')} />
          <div role="tablist" aria-label={t('notifyTab.digestTitle')} className="mt-[18px] grid grid-cols-4 rounded-[14px] bg-[#f5f2ef] p-1">
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
                  {t(d.label)}
                </button>
              );
            })}
          </div>
          {(draft.emailDigest === 'daily' || draft.emailDigest === 'weekly') && (
            <p className="mt-2.5 mb-0 text-[12.5px] text-stone-500">{t('notifyTab.digestNote')}</p>
          )}
          <div className="mt-[18px] flex gap-3.5 border-t border-[#f1ebe6] pt-[18px]">
            <span className="grid size-[38px] flex-none place-items-center rounded-full bg-[#fff1e6]">
              <MaterialIcon name="bedtime" size={20} filled color="#f26a1b" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-bold">{t('notifyTab.quietTitle')}</div>
              <div className="mt-0.5 text-[13.5px] text-stone-500">{t('notifyTab.quietSub')}</div>
              {draft.quiet.enabled && (
                <div className="mt-3 flex items-center gap-2 text-[15px] font-semibold">
                  <input type="time" aria-label={t('notifyTab.from')} value={draft.quiet.from} onChange={(e) => patch({ quiet: { ...draft.quiet, from: e.target.value } })} className={TIME_INPUT} />–
                  <input type="time" aria-label={t('notifyTab.to')} value={draft.quiet.to} onChange={(e) => patch({ quiet: { ...draft.quiet, to: e.target.value } })} className={TIME_INPUT} />
                </div>
              )}
            </div>
            <Toggle small label={t('notifyTab.quietTitle')} on={draft.quiet.enabled} onChange={(v) => patch({ quiet: { ...draft.quiet, enabled: v } })} />
          </div>
        </SCard>

        <SCard>
          <SHead icon="chat" title={t('notifyTab.dmTitle')} sub={t('notifyTab.dmSub')} className="mb-1.5" />
          {DM_ROWS.map((m) => (
            <div key={m.key} className="flex items-center gap-3.5 border-t border-[#f1ebe6] py-3.5">
              <span className="grid size-[38px] flex-none place-items-center rounded-full bg-[#fff1e6]">
                <MaterialIcon name={m.icon} size={20} color="#f26a1b" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-bold">{t(m.title)}</div>
                <div className="mt-0.5 text-[13px] text-stone-500">{t(m.sub)}</div>
              </div>
              <Toggle small label={t(m.title)} on={draft[m.key]} onChange={(v) => patch({ [m.key]: v })} />
            </div>
          ))}
        </SCard>
      </div>

      <SCard>
        <SHead
          icon="groups"
          title={t('notifyTab.perCommunityTitle')}
          sub={t('notifyTab.perCommunitySub')}
          action={
            <button
              type="button"
              onClick={() => setDraft((d) => ({ ...d, prefs: Object.fromEntries(Object.keys(d.prefs).map((id) => [id, { ...ALL_ON }])) }))}
              className="flex h-[42px] items-center gap-1.5 rounded-xl border-[1.5px] border-[#fdba74] bg-white px-4 text-[13.5px] font-bold text-brand"
            >
              <MaterialIcon name="refresh" size={19} />
              {t('notifyTab.reset')}
            </button>
          }
        />
        <div className="mt-[18px] overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="grid items-center gap-2.5 rounded-xl bg-[#f7f4f1] px-4 py-3 text-[13px] font-semibold text-stone-600" style={{ gridTemplateColumns: GRID }}>
              <span>{t('notifyTab.colCommunity')}</span>
              {COMMUNITY_COLUMNS.map((c) => (
                <span key={c.key} className="text-center">
                  {c.label}
                </span>
              ))}
            </div>
            {data.communities.length === 0 && <div className="px-2.5 py-8 text-center text-sm text-stone-500">{t('notifyTab.noCommunities')}</div>}
            {data.communities.map((c) => (
              <div key={c.id} className="grid items-center gap-2.5 border-b border-[#f1ebe6] px-4 py-3.5" style={{ gridTemplateColumns: GRID }}>
                <div className="flex min-w-0 items-center gap-3.5">
                  <CommunityLogo name={c.title} seed={c.id} size={44} src={c.logoUrl} />
                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-bold">{c.title}</div>
                    <div className="text-[13px] text-stone-500">{roleLabel(c.role)}</div>
                  </div>
                </div>
                {COMMUNITY_COLUMNS.map((col) => (
                  <div key={col.key} className="flex justify-center">
                    {c.applicable[col.key] ? (
                      <Toggle small label={`${col.label} · ${c.title}`} on={(draft.prefs[c.id] ?? ALL_ON)[col.key]} onChange={(v) => setCell(c.id, col.key, v)} />
                    ) : (
                      <span className="text-[#c7bfb8]" aria-label={t('notifyTab.notApplicable')}>
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
          {t('notifyTab.cancel')}
        </button>
        <button type="button" disabled={!dirty || save.isPending} onClick={onSave} className={`${PRIMARY_BTN} h-[54px] px-[30px] text-[15.5px]`}>
          {save.isPending ? t('notifyTab.saving') : t('notifyTab.save')}
          <MaterialIcon name="arrow_forward" size={20} />
        </button>
      </div>
    </>
  );
}

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { useAuth } from '../../auth/AuthContext';
import { fetchMembers } from '../api';
import { useMembers } from '../queries';
import type { CommunityMember } from '../types';
import { inputCls } from './contentUi';

const MAX_INVITEES = 200; // khớp giới hạn của backend

/** Chọn thành viên để mời vào sự kiện: tìm theo tên, bấm để thêm, chip để bỏ. `value` là map id → tên đã chọn. */
export function InviteePicker({ courseId, selfId, value, onChange }: { courseId: string; selfId?: string; value: Record<string, string>; onChange: (v: Record<string, string>) => void }) {
  const { t } = useTranslation('community');
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const [allBusy, setAllBusy] = useState(false);
  const [capped, setCapped] = useState(false);
  const { accessToken } = useAuth();
  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(id);
  }, [q]);
  const members = useMembers(courseId, { q: debounced || undefined, page: 1, filter: 'all', sort: 'active' });
  const results = (members.data?.data ?? []).filter((m: CommunityMember) => m.id !== selfId && !(m.id in value)).slice(0, 20);
  const showList = open || q.trim() !== '';

  /** Duyệt mọi trang thành viên (đang lọc theo ô tìm nếu có) rồi thêm vào danh sách mời, tối đa MAX_INVITEES. */
  const selectAll = async () => {
    if (!accessToken) return;
    setAllBusy(true);
    try {
      const next = { ...value };
      let page = 1;
      let totalPages = 1;
      setCapped(false);
      do {
        const r = await fetchMembers(courseId, { q: debounced || undefined, page, filter: 'all', sort: 'active' }, accessToken);
        totalPages = r.meta.totalPages;
        for (const m of r.data) {
          if (m.id === selfId || m.id in next) continue;
          if (Object.keys(next).length >= MAX_INVITEES) { setCapped(true); totalPages = 0; break; }
          next[m.id] = m.name;
        }
        page += 1;
      } while (page <= totalPages);
      onChange(next);
    } finally {
      setAllBusy(false);
    }
  };
  const ids = Object.keys(value);

  return (
    <div className="grid gap-2 sm:col-span-2" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false); }}>
      <input value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setOpen(true)} placeholder={t('calendar.inviteSearchPh')} aria-label={t('calendar.invite')} className={inputCls} />
      {(open || ids.length > 0) && (
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <button type="button" disabled={allBusy} onClick={selectAll} className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#fdba74] bg-white px-3 font-bold text-[#e8590c] disabled:opacity-60">
            <MaterialIcon name="group_add" size={16} color="#e8590c" /> {allBusy ? t('calendar.inviteLoading') : t('calendar.inviteAll')}
          </button>
          {ids.length > 0 && (
            <button type="button" onClick={() => { onChange({}); setCapped(false); }} className="font-semibold text-stone-500 underline hover:text-stone-800">{t('calendar.inviteClear', { n: ids.length })}</button>
          )}
          {capped && <span className="text-stone-500">{t('calendar.inviteCapped', { max: MAX_INVITEES })}</span>}
        </div>
      )}
      {ids.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {ids.map((id) => (
            <span key={id} className="inline-flex max-w-full items-center gap-1 rounded-full bg-brand/10 py-1 pr-1.5 pl-3 text-[13px] font-semibold text-stone-800">
              <span className="max-w-[160px] truncate">{value[id]}</span>
              <button
                type="button"
                aria-label={t('calendar.inviteRemove', { name: value[id] })}
                onClick={() => {
                  const { [id]: _, ...rest } = value;
                  onChange(rest);
                }}
                className="grid h-5 w-5 place-items-center rounded-full hover:bg-black/10"
              >
                <MaterialIcon name="close" size={14} />
              </button>
            </span>
          ))}
        </div>
      )}
      {showList && (
        <ul className="max-h-48 overflow-auto rounded-xl border border-[rgba(120,60,20,.1)]">
          {results.length === 0 ? (
            <li className="px-3 py-2 text-[13px] text-stone-500">{members.isFetching ? t('calendar.inviteLoading') : t('calendar.inviteNone')}</li>
          ) : (
            results.map((m) => (
              <li key={m.id}>
                <button type="button" onClick={() => {
                    onChange({ ...value, [m.id]: m.name });
                    setQ('');
                  }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-stone-50">
                  <MaterialIcon name="person_add" size={18} />
                  <span className="truncate">{m.name}</span>
                  <span className="ml-auto truncate text-xs text-stone-500">@{m.handle}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

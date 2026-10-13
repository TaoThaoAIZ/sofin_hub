import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { useMembers } from '../queries';
import type { CommunityMember } from '../types';
import { inputCls } from './contentUi';

/** Chọn thành viên để mời vào sự kiện: tìm theo tên, bấm để thêm, chip để bỏ. `value` là map id → tên đã chọn. */
export function InviteePicker({ courseId, selfId, value, onChange }: { courseId: string; selfId?: string; value: Record<string, string>; onChange: (v: Record<string, string>) => void }) {
  const { t } = useTranslation('community');
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(id);
  }, [q]);
  const members = useMembers(courseId, { q: debounced || undefined, page: 1, filter: 'all', sort: 'active' });
  const results = (members.data?.data ?? []).filter((m: CommunityMember) => m.id !== selfId && !(m.id in value)).slice(0, 8);
  const ids = Object.keys(value);

  return (
    <div className="grid gap-2 sm:col-span-2">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('calendar.inviteSearchPh')} aria-label={t('calendar.invite')} className={inputCls} />
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
      {q.trim() !== '' && (
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

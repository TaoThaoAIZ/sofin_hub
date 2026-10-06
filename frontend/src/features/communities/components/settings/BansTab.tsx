import { useTranslation } from 'react-i18next';
import { currentLocale } from '../../../../i18n';
import { useBans, useUnbanMember } from '../../queries';
import { errorText } from '../Modal';

export function BansTab({ courseId }: { courseId: string }) {
  const { t } = useTranslation('communities');
  const list = useBans(courseId, true);
  const unban = useUnbanMember(courseId);

  return (
    <section className="glass flex flex-col gap-4 rounded-[26px] p-6">
      <h2 className="m-0 text-lg font-extrabold">{t('bans.title')}</h2>
      {list.isPending && <p className="text-sm text-stone-500">{t('bans.loading')}</p>}
      {list.isError && <p className="text-sm text-red-600">{errorText(list.error)}</p>}
      {list.data?.length === 0 && <p className="py-4 text-center text-sm text-stone-500">{t('bans.empty')}</p>}
      {unban.isError && <p className="text-sm font-medium text-red-600">{errorText(unban.error)}</p>}
      <div className="flex flex-col gap-3">
        {list.data?.map((b) => (
          <div key={b.userId} className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/95 bg-white/75 p-4">
            <div className="min-w-0 flex-1">
              <b className="text-sm">{b.user.name}</b>
              <div className="mt-0.5 text-xs text-stone-500">{t('bans.bannedAt', { date: new Date(b.bannedAt).toLocaleString(currentLocale()) })}</div>
              <div className="mt-1 text-sm text-stone-700 break-words">{b.reason ? t('bans.reason', { reason: b.reason }) : <i className="text-stone-400">{t('bans.noReason')}</i>}</div>
            </div>
            <button
              type="button"
              disabled={unban.isPending}
              onClick={() => unban.mutate(b.userId)}
              className="h-9 rounded-lg border border-[rgba(120,60,20,.15)] bg-white px-4 text-[13px] font-semibold hover:bg-[#fff7f0] disabled:opacity-50"
            >
              {t('bans.unban')}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { usePopup } from '../../../components/ui/usePopup';
import { Avatar } from '../../account/components/Avatar';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { formatCompact } from '../../../lib/format';
import { useCommunities, useToggleEnrollment } from '../../courses/queries';
import { errText, toast, ToastHost } from './contentUi';
import type { CommunityDetail } from '../../courses/types';
import { useMembers } from '../queries';

// Màu lấy đúng từ bảng pal[]/logoStyle trong file thiết kế gốc SofinHub Community.html.
const AVATAR_PALETTE = ['#d6d3f5', '#cfe3f7', '#e5e7c9', '#cfe6d6', '#f3d4e6', '#dcd6cf', '#f5dcc8', '#d4dbe8'];
const LOGO_PALETTE = ['#1e3a8a', '#65a30d', '#1d4ed8', '#7c3aed', '#0f766e'];

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase() : name.slice(0, 2).toUpperCase();
}

export function CommunityRightSidebar({ course }: { course: CommunityDetail }) {
  const { t } = useTranslation('community');
  const navigate = useNavigate();
  const { confirm } = usePopup();
  const leave = useToggleEnrollment(course.id);
  const members = useMembers(course.id, {});
  const canLeave = course.viewerRole !== 'owner';
  const onLeave = async () => {
    const paid = course.priceUsd > 0;
    const ok = await confirm({
      title: paid ? t('rightSidebar.leavePaidTitle') : t('rightSidebar.leaveTitle'),
      message: paid ? t('rightSidebar.leavePaidMsg') : t('rightSidebar.leaveMsg'),
      tone: 'danger',
      confirmText: t('rightSidebar.leave'),
    });
    if (!ok) return;
    leave.mutate(undefined, {
      onSuccess: () => {
        toast(t('rightSidebar.left'));
        navigate(`/communities/${course.id}`);
      },
      onError: (e) => toast(errText(e), 'error'),
    });
  };
  const suggested = useCommunities({ page: 1, limit: 4, sort: 'trending' });
  const shownMembers = members.data?.data.slice(0, 6) ?? [];
  const remaining = Math.max(0, course.stats.members - shownMembers.length);
  const suggestedCourses = (suggested.data?.data ?? []).filter((c) => c.id !== course.id).slice(0, 3);

  return (
    <aside className="sticky top-[72px] flex flex-col gap-4 max-lg:static">
      <div className="glass overflow-hidden rounded-[22px]">
        <div className="relative h-[110px]">
          <img src={course.thumbnail} alt="" className="size-full object-cover" />
          <span className="absolute -bottom-[26px] left-[18px] grid size-[58px] place-items-center rounded-2xl border-[3px] border-white bg-[#0f1a2e] text-lg font-extrabold text-white shadow-lg">
            {course.title.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="px-[18px] pt-9 pb-[18px]">
          <div className="truncate text-[17px] font-extrabold">{course.title}</div>
          <div className="mt-1 truncate text-[12.5px] text-stone-500">{t('rightSidebar.by', { name: course.instructor.name })}</div>
          <div className="mt-2.5 grid grid-cols-3 border-t border-[rgba(120,60,20,.08)] pt-3 text-center">
            <div>
              <div className="text-[15px] font-bold">{formatCompact(course.stats.members)}</div>
              <div className="mt-0.5 text-[11px] text-stone-500">{t('info.members')}</div>
            </div>
            <div className="border-x border-[rgba(120,60,20,.08)]">
              <div className="text-[15px] font-bold">{course.stats.online}</div>
              <div className="mt-0.5 text-[11px] text-stone-500">{t('info.online')}</div>
            </div>
            <div>
              <div className="text-[15px] font-bold">{course.stats.admins}</div>
              <div className="mt-0.5 text-[11px] text-stone-500">{t('info.admins')}</div>
            </div>
          </div>

          {shownMembers.length > 0 && (
            <div className="mt-3.5 flex items-center">
              {shownMembers.map((m, i) => (
                <span key={m.id} className="flex-none rounded-full border-2 border-white" style={{ marginLeft: i ? -6 : 0 }}>
                  <Avatar url={m.avatarUrl} name={m.name} size={22} text={initials(m.name)} className="text-stone-700" style={{ background: AVATAR_PALETTE[i % AVATAR_PALETTE.length], fontSize: 9.5 }} />
                </span>
              ))}
              {remaining > 0 && <span className="ml-2 text-[12.5px] text-stone-600">+{formatCompact(remaining)}</span>}
            </div>
          )}

          <div className="mt-3.5 flex">
            <button
              type="button"
              disabled
              className="flex h-[42px] flex-1 items-center justify-center gap-2 rounded-2xl bg-brand/10 text-[13.5px] font-bold text-brand disabled:cursor-default"
            >
              <MaterialIcon name="check_circle" size={20} filled color="#f26a1b" />
              {t('rightSidebar.joined')}
            </button>
          </div>
          {canLeave && (
            <button
              type="button"
              onClick={() => void onLeave()}
              disabled={leave.isPending}
              className="mt-2 flex h-[42px] w-full items-center justify-center gap-2 rounded-2xl border-[1.5px] border-red-200 bg-white text-[13.5px] font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              <MaterialIcon name="logout" size={19} color="#dc2626" />
              {leave.isPending ? t('rightSidebar.leaving') : t('rightSidebar.leave')}
            </button>
          )}
          <ToastHost />
        </div>
      </div>

      {suggestedCourses.length > 0 && (
        <div className="glass rounded-[22px] p-4 pb-2.5">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[14.5px] font-bold">{t('rightSidebar.suggested')}</span>
            <Link to="/#courses" className="text-[12.5px] text-brand">
              {t('rightSidebar.viewAll')}
            </Link>
          </div>
          {suggestedCourses.map((c, i) => (
            <Link key={c.id} to={`/communities/${c.id}`} className="flex items-center gap-3 py-[7px] hover:opacity-90">
              <span
                className="grid size-[38px] flex-none place-items-center rounded-[10px] text-[11.5px] font-extrabold text-white"
                style={{ background: LOGO_PALETTE[i % LOGO_PALETTE.length] }}
              >
                {c.title.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-medium">{c.title}</div>
                <div className="text-xs text-stone-500">{t('rightSidebar.membersCount', { n: formatCompact(c.students) })}</div>
              </div>
              <span className="flex-none rounded-full border border-brand/20 bg-brand-soft px-3 py-1.5 text-[12.5px] font-semibold text-brand">
                {t('rightSidebar.join')}
              </span>
            </Link>
          ))}
        </div>
      )}

      <div className="glass flex flex-col gap-3.5 rounded-[22px] p-[18px] text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-amber-100">
          <MaterialIcon name="workspace_premium" size={26} filled color="#f59e0b" />
        </span>
        <div>
          <div className="text-[14.5px] font-extrabold">{t('rightSidebar.premiumTitle')}</div>
          <div className="mt-2.5 flex flex-col gap-1.5 text-left text-[12.5px] text-stone-600">
            <span className="flex items-center gap-2">
              <MaterialIcon name="check" size={16} color="#f26a1b" /> {t('rightSidebar.premium1')}
            </span>
            <span className="flex items-center gap-2">
              <MaterialIcon name="check" size={16} color="#f26a1b" /> {t('rightSidebar.premium2')}
            </span>
            <span className="flex items-center gap-2">
              <MaterialIcon name="check" size={16} color="#f26a1b" /> {t('rightSidebar.premium3')}
            </span>
          </div>
        </div>
        <button
          type="button"
          disabled
          title={t('rightSidebar.comingSoonTitle')}
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-brand text-[13.5px] font-bold text-white opacity-60"
        >
          <MaterialIcon name="arrow_forward" size={17} color="#fff" /> {t('rightSidebar.upgrade')}
        </button>
      </div>
    </aside>
  );
}

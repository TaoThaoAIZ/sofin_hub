import { Link } from 'react-router-dom';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { formatCompact } from '../../../lib/format';
import type { CommunityDetail } from '../../courses/types';
import { isAtLeast, ROLE_LABEL } from '../../communities/types';
import { useMembers } from '../queries';

// Bảng màu avatar lấy đúng từ pal[] trong file thiết kế gốc SofinHub Community.html.
export const AVATAR_PALETTE = ['#d6d3f5', '#cfe3f7', '#e5e7c9', '#cfe6d6', '#f3d4e6', '#dcd6cf', '#f5dcc8', '#d4dbe8'];

export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0))
    .slice(-2)
    .join('')
    .toUpperCase();

/** Banner đầu trang với ảnh minh họa nền lấy từ file thiết kế (public/images/community/*.webp). */
export function PageBanner({
  image,
  icon,
  title,
  subtitle,
  className = 'min-h-[140px]',
}: {
  image: string;
  icon: string;
  title: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <section
      className={`relative flex items-center overflow-hidden rounded-[28px] border border-brand/15 bg-gradient-to-r from-[#fff7f0] via-[#ffe9d9] to-[#ffdcc4] px-7 py-[22px] ${className}`}
    >
      <img src={`/images/community/${image}`} alt="" className="pointer-events-none absolute inset-0 size-full object-cover" />
      <div className="relative z-10 flex items-center gap-5">
        <span className="grid size-[72px] flex-none place-items-center rounded-full bg-white/85 shadow-[inset_0_1px_0_#fff,0_8px_20px_rgba(242,106,27,.18)]">
          <MaterialIcon name={icon} size={36} filled color="#f26a1b" />
        </span>
        <div>
          <h1 className="m-0 text-[32px] leading-tight font-extrabold tracking-tight md:text-[38px]">{title}</h1>
          {subtitle && <p className="mt-1 text-[15px] text-stone-700">{subtitle}</p>}
        </div>
      </div>
    </section>
  );
}

/** Thẻ thông tin cộng đồng bên phải (trang Thành viên / Giới thiệu). */
export function CommunityInfoCard({ course, coverHeight = 150 }: { course: CommunityDetail; coverHeight?: number }) {
  const members = useMembers(course.id, {});
  const shown = members.data?.data.slice(0, 8) ?? [];
  const remaining = Math.max(0, course.stats.members - shown.length);

  return (
    <aside className="sticky top-[76px] max-lg:static">
      <div className="glass overflow-hidden rounded-[20px]">
        <div className="bg-[#1c130e]" style={{ height: coverHeight }}>
          <img src={course.thumbnail} alt="" className="size-full object-cover" />
        </div>
        <div className="px-[18px] pt-4 pb-[18px]">
          <div className="text-lg font-extrabold">{course.title}</div>
          <Link to={`/communities/${course.id}`} className="mt-1 block truncate text-[13px] text-stone-600 hover:text-brand">
            sofinhub.com/communities/{course.id}
          </Link>
          <p className="mt-2.5 line-clamp-3 text-[13.5px] leading-[1.55] text-stone-800">{course.description}</p>
          <div className="mt-3.5 grid grid-cols-3 border-t border-[rgba(120,60,20,.08)] pt-3 text-center">
            {[
              { v: formatCompact(course.stats.members), l: 'Thành viên' },
              { v: course.stats.online, l: 'Trực tuyến' },
              { v: course.stats.admins, l: 'Quản trị viên' },
            ].map((s, i) => (
              <div key={s.l} className={i === 1 ? 'border-x border-[rgba(120,60,20,.08)]' : ''}>
                <div className="text-[17px] font-bold">{s.v}</div>
                <div className="mt-0.5 text-xs text-stone-500">{s.l}</div>
              </div>
            ))}
          </div>
          {shown.length > 0 && (
            <div className="mt-3.5 flex items-center">
              {shown.map((m, i) => (
                <span
                  key={m.id}
                  className="grid size-[26px] flex-none place-items-center rounded-full border-2 border-white text-[9.5px] font-bold text-stone-700"
                  style={{ background: AVATAR_PALETTE[i % AVATAR_PALETTE.length], marginLeft: i ? -6 : 0 }}
                >
                  {initials(m.name)}
                </span>
              ))}
              {remaining > 0 && (
                <span className="ml-2 rounded-full bg-stone-900/5 px-2 py-0.5 text-xs text-stone-600">+{formatCompact(remaining)}</span>
              )}
            </div>
          )}
          {course.viewerRole && (
            <div className="mt-4 flex items-center justify-between rounded-xl bg-stone-900/5 px-3.5 py-2.5 text-[13px]">
              <span className="text-stone-600">Vai trò của bạn</span>
              <span className="font-semibold text-stone-900">{ROLE_LABEL[course.viewerRole]}</span>
            </div>
          )}
          {isAtLeast(course.viewerRole, 'admin') && (
            <Link
              to={`/communities/${course.id}/community/cai-dat`}
              className="mt-3 flex h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-brand/10 text-sm font-semibold text-brand hover:bg-brand/15"
            >
              <MaterialIcon name="settings" size={19} color="#f26a1b" />
              Cài đặt
            </Link>
          )}
        </div>
      </div>
    </aside>
  );
}

import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { formatCompact } from '../../../lib/format';
import { useCommunities } from '../../courses/queries';
import type { CommunityDetail } from '../../courses/types';
import { useMyCommunities } from '../../search/queries';

const LOGO_PALETTE = ['#1e3a8a', '#65a30d', '#1d4ed8', '#7c3aed', '#0f766e'];

/** "Cộng đồng được đề xuất": cộng đồng TƯƠNG TỰ (cùng danh mục) với cộng đồng đang xem; dùng ở cột phải (desktop) và cuối bảng tin (mobile). */
export function SuggestedCommunities({ course, className = '' }: { course: CommunityDetail; className?: string }) {
  const { t } = useTranslation('community');
  // Gợi ý cộng đồng TƯƠNG TỰ: cùng danh mục với cộng đồng đang xem (thiếu thì bổ sung bằng cộng đồng nổi bật khác).
  const similar = useCommunities({ page: 1, limit: 12, sort: 'trending', category: course.category });
  const suggested = useCommunities({ page: 1, limit: 12, sort: 'trending' });
  const mine = useMyCommunities(); // không gợi ý cộng đồng mình đã tham gia / đang làm chủ
  const joinedIds = new Set((mine.data ?? []).map((m) => m.id));
  const suggestedCourses = mine.isPending
    ? []
    : [...(similar.data?.data ?? []), ...(suggested.data?.data ?? [])]
        .filter((c, i, all) => c.id !== course.id && !joinedIds.has(c.id) && all.findIndex((x) => x.id === c.id) === i)
        .slice(0, 3);

  if (suggestedCourses.length === 0) return null;
  return (
    <div className={`glass rounded-[22px] p-4 pb-2.5 ${className}`}>
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
  );
}

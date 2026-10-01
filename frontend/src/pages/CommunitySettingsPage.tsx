import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Header } from '../components/layout/Header';
import { ButtonLink } from '../components/ui/Button';
import { MaterialIcon } from '../components/ui/MaterialIcon';
import { useAuth } from '../features/auth/AuthContext';
import { BansTab } from '../features/communities/components/settings/BansTab';
import { DangerTab } from '../features/communities/components/settings/DangerTab';
import { GeneralTab } from '../features/communities/components/settings/GeneralTab';
import { InvitesTab } from '../features/communities/components/settings/InvitesTab';
import { JoinRequestsTab } from '../features/communities/components/settings/JoinRequestsTab';
import { isAtLeast, ROLE_LABEL } from '../features/communities/types';
import { CourseManager } from '../features/community/components/CourseManager';
import { ToastHost } from '../features/community/components/contentUi';
import { useCommunityDetail } from '../features/courses/queries';

type TabKey = 'general' | 'courses' | 'requests' | 'invites' | 'bans' | 'danger';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'general', label: 'Thông tin chung', icon: 'tune' },
  { key: 'courses', label: 'Khóa học', icon: 'school' },
  { key: 'requests', label: 'Yêu cầu tham gia', icon: 'how_to_reg' },
  { key: 'invites', label: 'Lời mời', icon: 'link' },
  { key: 'bans', label: 'Thành viên bị cấm', icon: 'block' },
  { key: 'danger', label: 'Vùng nguy hiểm', icon: 'warning' },
];

function Notice({ title, message, to }: { title: string; message: string; to: string }) {
  return (
    <div className="grid place-items-center px-4 py-24 text-center">
      <div>
        <p className="text-2xl font-bold">{title}</p>
        <p className="mt-2 text-stone-600">{message}</p>
        <ButtonLink to={to} className="mt-6 h-10 rounded-[14px] px-[18px] text-sm font-semibold">
          Quay lại
        </ButtonLink>
      </div>
    </div>
  );
}

/** Khu quản trị cộng đồng: /communities/:id/community/cai-dat — chỉ admin trở lên (BE vẫn chốt quyền ở từng API). */
export function CommunitySettingsPage() {
  const { id = '' } = useParams();
  const { status } = useAuth();
  const { data: course, isPending, error } = useCommunityDetail(id);
  const [tab, setTab] = useState<TabKey>('general');

  if (isPending || status === 'loading') {
    return (
      <div className="min-h-screen bg-white">
        <Header active="Cộng đồng" />
        <p className="py-24 text-center text-stone-500">Đang tải…</p>
      </div>
    );
  }
  if (error || !course) {
    return (
      <div className="min-h-screen bg-white">
        <Header active="Cộng đồng" />
        <Notice title="Không tìm thấy cộng đồng" message="Cộng đồng này có thể đã bị xóa hoặc không tồn tại." to="/" />
      </div>
    );
  }

  const role = course.viewerRole;
  if (!role || !isAtLeast(role, 'admin')) {
    return (
      <div className="min-h-screen bg-white">
        <Header active="Cộng đồng" />
        <Notice
          title="Bạn không có quyền truy cập"
          message="Khu cài đặt chỉ dành cho quản trị viên, chủ cộng đồng hoặc quản trị nền tảng."
          to={`/communities/${id}`}
        />
      </div>
    );
  }

  const visibleTabs = TABS.filter((t) => t.key !== 'danger' || isAtLeast(role, 'owner'));
  const activeTab = visibleTabs.some((t) => t.key === tab) ? tab : 'general';

  return (
    <div
      className="min-h-screen pb-16"
      style={{
        background:
          'radial-gradient(700px 500px at 0% 20%, rgba(255,186,140,.25), transparent 70%), radial-gradient(700px 600px at 100% 30%, rgba(251,207,232,.22), transparent 70%), #fdfbfa',
      }}
    >
      <Header active="Cộng đồng" />
      <div className="mx-auto max-w-[1000px] px-4 pt-6">
        <Link to={course.viewerEnrolled ? `/communities/${id}/community` : `/communities/${id}`} className="inline-flex items-center gap-1 text-sm font-medium text-stone-600 hover:text-brand">
          <MaterialIcon name="arrow_back" size={18} color="currentColor" />
          Về cộng đồng
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="m-0 min-w-0 text-[clamp(24px,3vw,32px)] font-extrabold tracking-[-0.5px] break-words">Cài đặt: {course.title}</h1>
          <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-bold text-brand">{ROLE_LABEL[role]}</span>
          {course.locked && <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">Đang bị khóa</span>}
        </div>

        <div className="mt-5 grid grid-cols-[220px_minmax(0,1fr)] items-start gap-5 max-md:grid-cols-1">
          <nav className="glass flex gap-1 rounded-2xl p-2 max-md:overflow-x-auto md:flex-col" aria-label="Mục cài đặt">
            {visibleTabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                aria-current={activeTab === t.key ? 'page' : undefined}
                className={`flex h-11 flex-none items-center gap-3 rounded-xl px-3.5 text-left text-[14px] whitespace-nowrap ${
                  activeTab === t.key ? 'bg-brand-soft font-semibold text-brand' : 'text-stone-900 hover:bg-stone-50'
                } ${t.key === 'danger' && activeTab !== t.key ? 'text-red-600' : ''}`}
              >
                <MaterialIcon name={t.icon} size={20} color="currentColor" />
                {t.label}
              </button>
            ))}
          </nav>

          <div className="min-w-0">
            {activeTab === 'general' && <GeneralTab course={course} viewerRole={role} />}
            {activeTab === 'courses' && (
              <div className="glass rounded-3xl p-5">
                <ToastHost />
                <CourseManager communityId={id} isAdmin={isAtLeast(role, 'admin')} />
              </div>
            )}
            {activeTab === 'requests' && <JoinRequestsTab courseId={id} isPrivate={course.visibility === 'private'} />}
            {activeTab === 'invites' && <InvitesTab courseId={id} />}
            {activeTab === 'bans' && <BansTab courseId={id} />}
            {activeTab === 'danger' && <DangerTab course={course} viewerRole={role} />}
          </div>
        </div>
      </div>
    </div>
  );
}

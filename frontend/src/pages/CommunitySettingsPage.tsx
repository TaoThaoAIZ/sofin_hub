import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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

const TABS: { key: TabKey; icon: string }[] = [
  { key: 'general', icon: 'tune' },
  { key: 'courses', icon: 'school' },
  { key: 'requests', icon: 'how_to_reg' },
  { key: 'invites', icon: 'link' },
  { key: 'bans', icon: 'block' },
  { key: 'danger', icon: 'warning' },
];

function Notice({ title, message, to }: { title: string; message: string; to: string }) {
  const { t } = useTranslation('communities');
  return (
    <div className="grid place-items-center px-4 py-24 text-center">
      <div>
        <p className="text-2xl font-bold">{title}</p>
        <p className="mt-2 text-stone-600">{message}</p>
        <ButtonLink to={to} className="mt-6 h-10 rounded-[14px] px-[18px] text-sm font-semibold">
          {t('settingsPage.back')}
        </ButtonLink>
      </div>
    </div>
  );
}

/** Khu quản trị cộng đồng: /communities/:id/community/cai-dat — chỉ admin trở lên (BE vẫn chốt quyền ở từng API). */
export function CommunitySettingsPage() {
  const { t } = useTranslation('communities');
  const { id = '' } = useParams();
  const { status } = useAuth();
  const { data: course, isPending, error } = useCommunityDetail(id);
  const [tab, setTab] = useState<TabKey>('general');

  if (isPending || status === 'loading') {
    return (
      <div className="min-h-screen bg-white">
        <Header active="myCommunities" />
        <p className="py-24 text-center text-stone-500">{t('settingsPage.loading')}</p>
      </div>
    );
  }
  if (error || !course) {
    return (
      <div className="min-h-screen bg-white">
        <Header active="myCommunities" />
        <Notice title={t('settingsPage.notFoundTitle')} message={t('settingsPage.notFoundMessage')} to="/" />
      </div>
    );
  }

  const role = course.viewerRole;
  if (!role || !isAtLeast(role, 'admin')) {
    return (
      <div className="min-h-screen bg-white">
        <Header active="myCommunities" />
        <Notice
          title={t('settingsPage.noAccessTitle')}
          message={t('settingsPage.noAccessMessage')}
          to={`/communities/${id}`}
        />
      </div>
    );
  }

  const visibleTabs = TABS.filter((tb) => tb.key !== 'danger' || isAtLeast(role, 'owner'));
  const activeTab = visibleTabs.some((tb) => tb.key === tab) ? tab : 'general';

  return (
    <div
      className="min-h-screen pb-16"
      style={{
        background:
          'radial-gradient(700px 500px at 0% 20%, rgba(255,186,140,.25), transparent 70%), radial-gradient(700px 600px at 100% 30%, rgba(251,207,232,.22), transparent 70%), #fdfbfa',
      }}
    >
      <Header active="myCommunities" />
      <div className="mx-auto max-w-[1000px] px-4 pt-6">
        <Link to={course.viewerEnrolled ? `/communities/${id}/community` : `/communities/${id}`} className="inline-flex items-center gap-1 text-sm font-medium text-stone-600 hover:text-brand">
          <MaterialIcon name="arrow_back" size={18} color="currentColor" />
          {t('settingsPage.backToCommunity')}
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="m-0 min-w-0 text-[clamp(24px,3vw,32px)] font-extrabold tracking-[-0.5px] break-words">{t('settingsPage.heading', { title: course.title })}</h1>
          <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-bold text-brand">{ROLE_LABEL[role]}</span>
          {course.locked && <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">{t('settingsPage.locked')}</span>}
        </div>

        <div className="mt-5 grid grid-cols-[220px_minmax(0,1fr)] items-start gap-5 max-md:grid-cols-1">
          <nav className="glass flex gap-1 rounded-2xl p-2 max-md:overflow-x-auto md:flex-col" aria-label={t('settingsPage.navLabel')}>
            {visibleTabs.map((tb) => (
              <button
                key={tb.key}
                type="button"
                onClick={() => setTab(tb.key)}
                aria-current={activeTab === tb.key ? 'page' : undefined}
                className={`flex h-11 flex-none items-center gap-3 rounded-xl px-3.5 text-left text-[14px] whitespace-nowrap ${
                  activeTab === tb.key ? 'bg-brand-soft font-semibold text-brand' : 'text-stone-900 hover:bg-stone-50'
                } ${tb.key === 'danger' && activeTab !== tb.key ? 'text-red-600' : ''}`}
              >
                <MaterialIcon name={tb.icon} size={20} color="currentColor" />
                {t(`settingsPage.tabs.${tb.key}`)}
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

import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '../components/PageTitle';
import { Navigate, Outlet, useParams } from 'react-router-dom';
import { Header } from '../components/layout/Header';
import { CommunitySidebar } from '../features/community/components/CommunitySidebar';
import { CommunityBotWidget } from '../features/community-bot/CommunityBotWidget';
import { GreetingPopup } from '../features/community-greetings/GreetingPopup';
import { useCommunityDetail } from '../features/courses/queries';

export function CommunityPage() {
  const { t } = useTranslation('community');
  const { id = '' } = useParams();
  const { data: course, isPending } = useCommunityDetail(id);
  useDocumentTitle(course?.title);

  if (isPending) {
    return (
      <div className="min-h-screen">
        <Header active="myCommunities" />
        <p className="py-24 text-center text-stone-500">{t('page.loading')}</p>
      </div>
    );
  }

  if (!course) return <Navigate to="/" replace />;
  // Chặn ở FE cho trải nghiệm mượt (redirect thay vì hiện lỗi 403) — quyền thật luôn được BE
  // xác thực lại ở từng API (bảng tin/lớp học/lịch/thành viên/xếp hạng), không tin riêng cờ này.
  if (!course.viewerEnrolled && course.viewerRole !== 'platform_admin') return <Navigate to={`/communities/${id}`} replace />;

  return (
    <div className="min-h-screen">
      <Header active="myCommunities" />
      <div className="mx-auto grid w-[calc(100%-32px)] max-w-[1320px] grid-cols-[248px_minmax(0,1fr)] items-start gap-6 pt-3 pb-10 md:w-[calc(100%-80px)] max-md:grid-cols-1">
        <CommunitySidebar courseTitle={course.title} />
        <div className="min-w-0">
          <Outlet context={{ course }} />
        </div>
      </div>
      {/* Trợ lý AI riêng của cộng đồng (chỉ hiện khi chủ đã bật + gói Pro) — chatbot.md. */}
      <CommunityBotWidget communityId={id} />
      {/* Lời chào thành viên mới (1 lần) + thông báo mới nhất của chủ — chỉ ở trang của cộng đồng này. */}
      <GreetingPopup communityId={id} />
    </div>
  );
}

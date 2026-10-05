import { Navigate, Outlet, useParams } from 'react-router-dom';
import { Header } from '../components/layout/Header';
import { CommunitySidebar } from '../features/community/components/CommunitySidebar';
import { useCommunityDetail } from '../features/courses/queries';

export function CommunityPage() {
  const { id = '' } = useParams();
  const { data: course, isPending } = useCommunityDetail(id);

  if (isPending) {
    return (
      <div className="min-h-screen bg-white">
        <Header active="Cộng đồng của tôi" />
        <p className="py-24 text-center text-stone-500">Đang tải cộng đồng…</p>
      </div>
    );
  }

  if (!course) return <Navigate to="/" replace />;
  // Chặn ở FE cho trải nghiệm mượt (redirect thay vì hiện lỗi 403) — quyền thật luôn được BE
  // xác thực lại ở từng API (bảng tin/lớp học/lịch/thành viên/xếp hạng), không tin riêng cờ này.
  if (!course.viewerEnrolled) return <Navigate to={`/communities/${id}`} replace />;

  return (
    <div className="min-h-screen bg-white">
      <Header active="Cộng đồng của tôi" />
      <div className="mx-auto grid w-[calc(100%-32px)] max-w-[1320px] grid-cols-[248px_minmax(0,1fr)] items-start gap-6 pt-3 pb-10 md:w-[calc(100%-80px)] max-md:grid-cols-1">
        <CommunitySidebar courseTitle={course.title} />
        <div className="min-w-0">
          <Outlet context={{ course }} />
        </div>
      </div>
    </div>
  );
}

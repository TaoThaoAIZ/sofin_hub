import { useNavigate, useParams } from 'react-router-dom';
import { Header } from '../components/layout/Header';
import { useCommunityDetail } from '../features/courses/queries';
import { JoinCheckout } from '../features/payments/components/JoinDialog';
import { RequireAuth } from '../features/auth/RequireAuth';

/**
 * /communities/:id/checkout — cùng nội dung với hộp thoại "Chọn gói thành viên" ở trang chi tiết
 * (dùng chung JoinCheckout: báo giá từ BE, thẻ tokenise mock, dùng thử/thanh toán), hiển thị dạng trang riêng
 * cho link trực tiếp / luồng cũ.
 */
export function CheckoutPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data: course, isPending } = useCommunityDetail(id);

  return (
    <div className="min-h-screen bg-[#faf8f6]">
      <Header active="Khóa học" />
      <RequireAuth>
        <div className="mx-auto max-w-[560px] px-4 py-10">
          {isPending && <p className="py-24 text-center text-stone-500">Đang tải…</p>}
          {!isPending && !course && <p className="py-24 text-center text-stone-500">Không tìm thấy cộng đồng.</p>}
          {course && (
            <JoinCheckout
              course={course}
              onClose={() => navigate(`/communities/${id}`)}
              onDone={() => navigate(`/communities/${id}/community`, { replace: true })}
              onNeedRequest={() => navigate(`/communities/${id}`, { replace: true })}
            />
          )}
        </div>
      </RequireAuth>
    </div>
  );
}

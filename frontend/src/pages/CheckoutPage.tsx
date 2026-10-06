import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('payments');
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data: course, isPending } = useCommunityDetail(id);

  return (
    <div className="min-h-screen bg-[#faf8f6]">
      <Header active="courses" />
      <RequireAuth>
        <div className="mx-auto max-w-[560px] px-4 py-10">
          {isPending && <p className="py-24 text-center text-stone-500">{t('checkout.loading')}</p>}
          {!isPending && !course && <p className="py-24 text-center text-stone-500">{t('checkout.notFound')}</p>}
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

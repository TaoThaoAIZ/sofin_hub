import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Header } from '../components/layout/Header';
import { Button, ButtonLink } from '../components/ui/Button';
import { MaterialIcon } from '../components/ui/MaterialIcon';
import { useAuth } from '../features/auth/AuthContext';
import { errorText } from '../features/communities/components/Modal';
import { useAcceptInvite, useInvitePreview } from '../features/communities/queries';
import { formatCompact } from '../lib/format';
import { ApiError } from '../lib/api';

const GONE_TITLE: Record<string, string> = {
  INVITE_REVOKED: 'Lời mời đã bị thu hồi',
  INVITE_EXPIRED: 'Lời mời đã hết hạn',
  INVITE_EXHAUSTED: 'Lời mời đã hết lượt sử dụng',
};

function Shell({ children }: { children: ReactNode }) {
  return (
    <div
      className="min-h-screen pb-16"
      style={{
        background:
          'radial-gradient(700px 500px at 0% 20%, rgba(255,186,140,.3), transparent 70%), radial-gradient(700px 600px at 100% 30%, rgba(251,207,232,.28), transparent 70%), #fff',
      }}
    >
      <Header active="Cộng đồng của tôi" />
      <div className="mx-auto max-w-[520px] px-4 pt-10">{children}</div>
    </div>
  );
}

function Problem({ icon, title, message }: { icon: string; title: string; message: string }) {
  return (
    <div className="glass rounded-[26px] p-8 text-center">
      <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand/10">
        <MaterialIcon name={icon} size={28} color="#f26a1b" />
      </div>
      <h1 className="mt-4 text-xl font-extrabold">{title}</h1>
      <p className="mt-2 text-sm text-stone-600">{message}</p>
      <ButtonLink to="/" className="mx-auto mt-6 h-11 rounded-xl px-6 text-sm font-bold">
        Về trang chủ
      </ButtonLink>
    </div>
  );
}

export function InvitePage() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const { status } = useAuth();
  const preview = useInvitePreview(code);
  const accept = useAcceptInvite(code);
  const [notice, setNotice] = useState<string | null>(null);

  if (preview.isPending) {
    return (
      <Shell>
        <p className="py-16 text-center text-stone-500">Đang tải lời mời…</p>
      </Shell>
    );
  }

  if (preview.isError || !preview.data) {
    const err = preview.error;
    if (err instanceof ApiError && err.status === 410) {
      return (
        <Shell>
          <Problem icon="link_off" title={GONE_TITLE[err.code ?? ''] ?? 'Lời mời không còn hiệu lực'} message="Hãy nhờ quản trị viên cộng đồng gửi cho bạn một liên kết mời mới." />
        </Shell>
      );
    }
    if (err instanceof ApiError && err.status === 404) {
      return (
        <Shell>
          <Problem icon="search_off" title="Không tìm thấy lời mời" message="Liên kết có thể bị sai hoặc cộng đồng đã bị xóa." />
        </Shell>
      );
    }
    return (
      <Shell>
        <Problem icon="error" title="Không tải được lời mời" message={errorText(err)} />
      </Shell>
    );
  }

  const { course, remainingUses, expiresAt } = preview.data;
  const paid = course.priceUsd > 0;

  const join = () => {
    setNotice(null);
    if (status !== 'authenticated') {
      navigate('/login', { state: { from: `/invite/${code}` } });
      return;
    }
    accept.mutate(undefined, {
      onSuccess: ({ courseId }) => navigate(`/communities/${courseId}/community`),
      onError: (e) => {
        const apiErr = e instanceof ApiError ? e : null;
        if (apiErr?.status === 409) {
          // Đã là thành viên: vào thẳng cộng đồng.
          navigate(`/communities/${course.id}/community`);
          return;
        }
        if (apiErr?.status === 402) {
          setNotice('Cộng đồng này có phí. Bạn cần thanh toán để tham gia.');
          return;
        }
        if (apiErr?.status === 410) {
          // Lời mời vừa hết hiệu lực trong lúc bạn đang xem: tải lại để hiện đúng trạng thái.
          void preview.refetch();
          return;
        }
        setNotice(errorText(e));
      },
    });
  };

  const needsPayment = accept.error instanceof ApiError && accept.error.status === 402;

  return (
    <Shell>
      <div className="glass overflow-hidden rounded-[26px]">
        <div className="h-[180px] bg-[#1c130e]">
          <img src={course.thumbnail} alt="" className="size-full object-cover" />
        </div>
        <div className="p-6">
          <p className="text-[13px] font-semibold text-brand">Bạn được mời tham gia</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight break-words">{course.title}</h1>
          <div className="mt-3 flex flex-wrap gap-2 text-[13px]">
            <span className="glass-chip flex items-center gap-1.5 rounded-full px-3 py-1.5">
              <MaterialIcon name="group" size={16} color="#f26a1b" />
              {formatCompact(course.members)} thành viên
            </span>
            <span className="glass-chip flex items-center gap-1.5 rounded-full px-3 py-1.5">
              <MaterialIcon name={course.visibility === 'private' ? 'lock' : 'public'} size={16} color="#f26a1b" />
              {course.visibility === 'private' ? 'Riêng tư' : 'Công khai'}
            </span>
            <span className="glass-chip flex items-center gap-1.5 rounded-full px-3 py-1.5">
              <MaterialIcon name="sell" size={16} color="#f26a1b" />
              {paid ? `$${course.priceUsd}/tháng` : 'Miễn phí'}
            </span>
          </div>
          {(remainingUses !== null || expiresAt) && (
            <p className="mt-3 text-xs text-stone-500">
              {remainingUses !== null && <>Còn {remainingUses} lượt sử dụng. </>}
              {expiresAt && <>Hết hạn {new Date(expiresAt).toLocaleString('vi-VN')}.</>}
            </p>
          )}
          {course.visibility === 'private' && !paid && (
            <p className="mt-3 text-[13px] text-stone-600">Lời mời này cho phép bạn vào thẳng, không cần chờ duyệt.</p>
          )}
          {paid && <p className="mt-3 text-[13px] text-stone-600">Đây là cộng đồng có phí — sau khi bấm Tham gia, bạn sẽ được hướng dẫn thanh toán.</p>}

          <Button onClick={join} disabled={accept.isPending} className="mt-5 h-12 w-full rounded-2xl text-base font-bold">
            {accept.isPending ? 'Đang tham gia…' : status === 'authenticated' ? 'Tham gia' : 'Đăng nhập để tham gia'}
          </Button>
          {notice && (
            <p role="alert" className="mt-3 text-center text-sm font-medium text-red-600">
              {notice}
            </p>
          )}
          {needsPayment && (
            <Link to={`/communities/${course.id}/checkout`} className="mt-2 block text-center text-sm font-semibold text-brand hover:underline">
              Đi tới thanh toán
            </Link>
          )}
          <Link to={`/communities/${course.id}`} className="mt-4 block text-center text-sm text-stone-600 hover:text-brand">
            Xem trang giới thiệu cộng đồng
          </Link>
        </div>
      </div>
    </Shell>
  );
}

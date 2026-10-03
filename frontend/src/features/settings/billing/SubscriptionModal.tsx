import { useState } from 'react';
import { ApiError } from '../../../lib/api';
import { formatCents, formatDate } from '../../../lib/datetime';
import { useToast } from '../../admin/components/overlay';
import { useCancelSubscription, useResumeSubscription } from '../../payments/queries';
import type { PaymentRecord, Subscription } from '../../payments/types';
import { ModalActions, ModalError, SettingsModal } from './Modal';
import { useAllPayments } from './queries';

const refundText = (s: PaymentRecord['refundStatus']) =>
  s === 'approved' ? 'Đã được hoàn tiền' : s === 'rejected' ? 'Yêu cầu hoàn tiền đã bị từ chối' : s ? 'Yêu cầu hoàn tiền đang chờ duyệt' : null;

/**
 * "Quản lý" gói: hủy cuối kỳ (vẫn dùng tới hết kỳ) / hủy ngay / kích hoạt lại + lối vào "Yêu cầu hoàn tiền".
 * Đây là nơi giữ lại đủ khả năng của trang /billing cũ (hủy ngay, tiếp tục gói, hoàn tiền).
 */
export function SubscriptionModal({ sub, onClose, onRefund }: { sub: Subscription; onClose: () => void; onRefund: (p: PaymentRecord) => void }) {
  const toast = useToast();
  const cancel = useCancelSubscription();
  const resume = useResumeSubscription();
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(false);
  const live = sub.status === 'active' || sub.status === 'trialing';
  const canceling = live && sub.cancelAtPeriodEnd;
  const end = formatDate(sub.accessUntil ?? sub.currentPeriodEnd);
  const per = sub.interval === 'annual' ? 'năm' : 'tháng';
  const title = sub.courseTitle ?? 'Gói thành viên';
  const pending = cancel.isPending || resume.isPending;

  // Giao dịch gần nhất của gói này (để hoàn tiền): chỉ nạp khi mở hộp thoại.
  const payments = useAllPayments(true);
  const mine = payments.data?.filter((p) => p.courseId === sub.courseId) ?? [];
  const latest = mine.find((p) => p.status === 'succeeded' && !(p.refundedCents && p.refundedCents > 0));
  const lastState = mine.find((p) => p.refundStatus)?.refundStatus ?? null;

  const fail = (e: unknown) => setError(e instanceof ApiError ? e.message : 'Đã có lỗi xảy ra, vui lòng thử lại');
  const doCancel = () => {
    setError(null);
    cancel.mutate(
      { courseId: sub.courseId, atPeriodEnd: !now },
      {
        onSuccess: () => {
          toast.success(`Đã hủy gói · ${title}`);
          onClose();
        },
        onError: fail,
      },
    );
  };
  const doResume = () => {
    setError(null);
    resume.mutate(sub.courseId, {
      onSuccess: () => {
        toast.success(`Đã kích hoạt lại · ${title}`);
        onClose();
      },
      onError: fail,
    });
  };

  const body = !live
    ? `Gói đã kết thúc${sub.status === 'expired' ? ' do hết hạn' : ''}. Hãy tham gia lại từ trang cộng đồng nếu muốn tiếp tục.`
    : canceling
      ? `Gói đã hủy. Bạn vẫn dùng được tới ${end}.`
      : sub.status === 'trialing'
        ? `Đang dùng thử tới ${formatDate(sub.trialEndsAt ?? sub.currentPeriodEnd)}, sau đó trừ ${formatCents(sub.priceCents)} / ${per}. Hủy gói thì bạn vẫn dùng được tới hết thời gian dùng thử.`
        : `Gói ${formatCents(sub.priceCents)} / ${per}, gia hạn ${end}. Hủy gói thì bạn vẫn dùng được tới ngày gia hạn.`;

  return (
    <SettingsModal title={title} body={body} onClose={onClose} busy={pending}>
      {live && !canceling && (
        <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-[#f0ebe6] px-3.5 py-3 text-[13.5px]">
          <input type="checkbox" checked={now} onChange={(e) => setNow(e.target.checked)} className="mt-0.5 accent-[#f26a1b]" />
          <span>
            <b className="block font-bold">Hủy ngay</b>
            <span className="text-stone-500">Mất quyền truy cập cộng đồng lập tức, thay vì tới hết kỳ.</span>
          </span>
        </label>
      )}
      {(latest || lastState) && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-[#faf7f4] px-3.5 py-3 text-[13.5px]">
          <span className="text-stone-600">{refundText(lastState) ?? `Giao dịch gần nhất ${formatCents(latest!.amountCents ?? Math.round(latest!.amountUsd * 100))}`}</span>
          {latest && !lastState && (
            <button type="button" onClick={() => onRefund(latest)} className="border-0 bg-transparent p-0 font-bold text-[#15803d] underline">
              Yêu cầu hoàn tiền
            </button>
          )}
        </div>
      )}
      {error && <ModalError>{error}</ModalError>}
      {live ? (
        <ModalActions cancelLabel="Đóng" okLabel={canceling ? 'Kích hoạt lại' : now ? 'Hủy gói ngay' : 'Hủy gói'} danger={!canceling} pending={pending} onCancel={onClose} onOk={canceling ? doResume : doCancel} />
      ) : (
        <ModalActions cancelLabel="Đóng" okLabel="Xong" onCancel={onClose} onOk={onClose} />
      )}
    </SettingsModal>
  );
}

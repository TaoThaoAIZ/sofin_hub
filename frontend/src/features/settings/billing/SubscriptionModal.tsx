import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../../i18n';
import { ApiError } from '../../../lib/api';
import { formatCents, formatDate } from '../../../lib/datetime';
import { useToast } from '../../admin/components/overlay';
import { useCancelSubscription, useResumeSubscription } from '../../payments/queries';
import type { PaymentRecord, Subscription } from '../../payments/types';
import { ModalActions, ModalError, SettingsModal } from './Modal';
import { useAllPayments } from './queries';

const refundText = (s: PaymentRecord['refundStatus']) =>
  s === 'approved' ? i18n.t('subscription.refunded', { ns: 'settings' }) : s === 'rejected' ? i18n.t('subscription.refundRejected', { ns: 'settings' }) : s ? i18n.t('subscription.refundPending', { ns: 'settings' }) : null;

/**
 * "Quản lý" gói: hủy cuối kỳ (vẫn dùng tới hết kỳ) / hủy ngay / kích hoạt lại + lối vào "Yêu cầu hoàn tiền".
 * Đây là nơi giữ lại đủ khả năng của trang /billing cũ (hủy ngay, tiếp tục gói, hoàn tiền).
 */
export function SubscriptionModal({ sub, onClose, onRefund }: { sub: Subscription; onClose: () => void; onRefund: (p: PaymentRecord) => void }) {
  const { t } = useTranslation('settings');
  const toast = useToast();
  const cancel = useCancelSubscription();
  const resume = useResumeSubscription();
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(false);
  const live = sub.status === 'active' || sub.status === 'trialing';
  const canceling = live && sub.cancelAtPeriodEnd;
  const end = formatDate(sub.accessUntil ?? sub.currentPeriodEnd);
  const per = sub.interval === 'annual' ? t('subscription.perYear') : t('subscription.perMonth');
  const title = sub.courseTitle ?? t('subscription.defaultTitle');
  const pending = cancel.isPending || resume.isPending;

  // Giao dịch gần nhất của gói này (để hoàn tiền): chỉ nạp khi mở hộp thoại.
  const payments = useAllPayments(true);
  const mine = payments.data?.filter((p) => p.courseId === sub.courseId) ?? [];
  const latest = mine.find((p) => p.status === 'succeeded' && !(p.refundedCents && p.refundedCents > 0));
  const lastState = mine.find((p) => p.refundStatus)?.refundStatus ?? null;

  const fail = (e: unknown) => setError(e instanceof ApiError ? e.message : t('common.genericError'));
  const doCancel = () => {
    setError(null);
    cancel.mutate(
      { courseId: sub.courseId, atPeriodEnd: !now },
      {
        onSuccess: () => {
          toast.success(t('subscription.canceledToast', { title }));
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
        toast.success(t('subscription.resumedToast', { title }));
        onClose();
      },
      onError: fail,
    });
  };

  const body = !live
    ? t('subscription.bodyEnded', { reason: sub.status === 'expired' ? t('subscription.endedExpired') : '' })
    : canceling
      ? t('subscription.bodyCanceling', { end })
      : sub.status === 'trialing'
        ? t('subscription.bodyTrialing', { trialEnd: formatDate(sub.trialEndsAt ?? sub.currentPeriodEnd), price: formatCents(sub.priceCents), per })
        : t('subscription.bodyActive', { price: formatCents(sub.priceCents), per, end });

  return (
    <SettingsModal title={title} body={body} onClose={onClose} busy={pending}>
      {live && !canceling && (
        <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-[#f0ebe6] px-3.5 py-3 text-[13.5px]">
          <input type="checkbox" checked={now} onChange={(e) => setNow(e.target.checked)} className="mt-0.5 accent-[#f26a1b]" />
          <span>
            <b className="block font-bold">{t('subscription.cancelNow')}</b>
            <span className="text-stone-500">{t('subscription.cancelNowHint')}</span>
          </span>
        </label>
      )}
      {(latest || lastState) && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-[#faf7f4] px-3.5 py-3 text-[13.5px]">
          <span className="text-stone-600">{refundText(lastState) ?? t('subscription.latestPayment', { amount: formatCents(latest!.amountCents ?? latest!.amountUsd) })}</span>
          {latest && !lastState && (
            <button type="button" onClick={() => onRefund(latest)} className="border-0 bg-transparent p-0 font-bold text-[#15803d] underline">
              {t('subscription.requestRefund')}
            </button>
          )}
        </div>
      )}
      {error && <ModalError>{error}</ModalError>}
      {live ? (
        <ModalActions cancelLabel={t('common.close')} okLabel={canceling ? t('subscription.reactivate') : now ? t('subscription.cancelPlanNow') : t('subscription.cancelPlan')} danger={!canceling} pending={pending} onCancel={onClose} onOk={canceling ? doResume : doCancel} />
      ) : (
        <ModalActions cancelLabel={t('common.close')} okLabel={t('common.done')} onCancel={onClose} onOk={onClose} />
      )}
    </SettingsModal>
  );
}

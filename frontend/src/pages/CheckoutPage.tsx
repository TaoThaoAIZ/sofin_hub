import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Header } from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { MaterialIcon } from '../components/ui/MaterialIcon';
import { ApiError } from '../lib/api';
import { useCommunityDetail } from '../features/courses/queries';
import { useCheckout, useConfirmPayment, useStartTrial } from '../features/payments/queries';
import type { PaymentMethod } from '../features/payments/types';

const METHODS: { key: PaymentMethod; label: string; desc: string }[] = [
  { key: 'vnpay', label: 'VNPay', desc: 'Quét mã QR / thẻ ATM nội địa' },
  { key: 'momo', label: 'MoMo', desc: 'Ví điện tử MoMo' },
  { key: 'stripe', label: 'Stripe', desc: 'Thẻ Visa / Mastercard quốc tế' },
];

export function CheckoutPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data: course, isPending } = useCommunityDetail(id);
  const checkout = useCheckout(id);
  const confirm = useConfirmPayment();
  const trial = useStartTrial(id);
  const [method, setMethod] = useState<PaymentMethod>('vnpay');
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  if (isPending) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <p className="py-24 text-center text-stone-500">Đang tải…</p>
      </div>
    );
  }
  if (!course) return null;

  const startTrial = async () => {
    setError(null);
    try {
      await trial.mutateAsync();
      navigate(`/communities/${id}/community`, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không bắt đầu dùng thử được, vui lòng thử lại');
    }
  };

  const submit = async () => {
    setError(null);
    setProcessing(true);
    try {
      const intent = await checkout.mutateAsync(method);
      await new Promise((r) => setTimeout(r, 900)); // mô phỏng thời gian xử lý ở cổng thanh toán
      await confirm.mutateAsync(intent.id);
      navigate(`/communities/${id}/community`, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Thanh toán thất bại, vui lòng thử lại');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Header active="Khóa học" />
      <div className="mx-auto max-w-[720px] px-4 py-10 md:px-0">
        <h1 className="text-2xl font-extrabold">Xác nhận thanh toán</h1>
        <p className="mt-1 text-sm text-stone-500">Hoàn tất thanh toán để tham gia cộng đồng "{course.title}".</p>

        <div className="glass mt-6 flex items-center gap-4 rounded-2xl p-4">
          <img src={course.thumbnail} alt="" className="size-16 flex-none rounded-xl object-cover" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-bold">{course.title}</div>
            <div className="text-[12.5px] text-stone-500">Bởi {course.instructor.name}</div>
          </div>
          <div className="flex-none text-right">
            <div className="text-xl font-extrabold text-brand">${course.priceUsd}</div>
            <div className="text-[11px] text-stone-500">/tháng</div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-green-50 px-4 py-3 text-[13px] font-medium text-green-700">
          <MaterialIcon name="redeem" size={18} color="#15803d" />
          <span className="min-w-0 flex-1">Dùng thử miễn phí 7 ngày — hủy bất cứ lúc nào trước khi hết hạn, không mất phí.</span>
          <button
            type="button"
            disabled={processing || trial.isPending}
            onClick={startTrial}
            className="h-9 rounded-xl border border-green-600 bg-white px-3.5 text-[13px] font-bold text-green-700 hover:bg-green-100 disabled:opacity-60"
          >
            {trial.isPending ? 'Đang kích hoạt…' : 'Bắt đầu dùng thử'}
          </button>
        </div>

        <div className="mt-6">
          <div className="mb-2.5 text-sm font-bold">Chọn phương thức thanh toán</div>
          <div className="flex flex-col gap-2.5">
            {METHODS.map((m) => (
              <label
                key={m.key}
                className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 ${
                  method === m.key ? 'border-brand bg-brand/5' : 'border-[rgba(120,60,20,.12)]'
                }`}
              >
                <input type="radio" name="method" checked={method === m.key} onChange={() => setMethod(m.key)} className="accent-brand" />
                <div>
                  <div className="text-[14.5px] font-semibold">{m.label}</div>
                  <div className="text-[12.5px] text-stone-500">{m.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {error && <div role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600">{error}</div>}

        <Button onClick={submit} disabled={processing} className="mt-6 h-[52px] w-full rounded-2xl text-base font-bold">
          {processing ? 'Đang xử lý…' : `Thanh toán $${course.priceUsd}/tháng`}
        </Button>

        <p className="mt-4 text-center text-[12px] leading-relaxed text-stone-400">
          Bản demo: chưa nối cổng thanh toán thật (Stripe/VNPay/MoMo đang chờ chốt ở PLAN.md) — bấm "Thanh toán" sẽ tạo giao dịch
          thật ở server và cấp quyền truy cập ngay, thay cho bước redirect sang cổng thanh toán.
        </p>
      </div>
    </div>
  );
}

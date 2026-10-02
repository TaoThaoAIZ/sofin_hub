import type { ReactNode } from 'react';
import { MaterialIcon } from '../../components/ui/MaterialIcon';
import { FieldError } from '../../components/ui/FieldMessage';
import { formatMoney } from '../../lib/format';
import type { StepProps } from './StepBasics';
import type { FeeInfo, HostPlanInfo } from './types';
import { SegTabs } from './ui';

export function StepHostPlan({
  form,
  set,
  errors,
  plans,
  plansLoading,
  plansError,
  fees,
  trialEndLabel,
  cardSlot,
}: StepProps & {
  plans: HostPlanInfo[];
  plansLoading: boolean;
  plansError?: string;
  fees?: FeeInfo;
  trialEndLabel?: string;
  cardSlot: ReactNode;
}) {
  const pro = plans.find((p) => !p.free);
  const free = plans.find((p) => p.free);
  const savePct = pro?.annualSavingsPct;
  const rev = form.revenueEstimate;
  const cycle = form.hostCycle;
  const proPerMonth = pro ? (cycle === 'annual' ? pro.annualPrice / 12 : pro.monthlyPrice) : 0;
  const feeFree = fees ? Math.round(rev * fees.freeFeeRate) : 0;
  const feePro = fees && pro ? Math.round(proPerMonth + rev * fees.proFeeRate) : 0;
  const breakEven = fees && pro && fees.freeFeeRate > fees.proFeeRate ? Math.round(proPerMonth / (fees.freeFeeRate - fees.proFeeRate)) : 0;
  const currency = pro?.currency ?? free?.currency ?? 'USD';

  return (
    <div>
      {plansLoading && <p className="mt-6 text-stone-500">Đang tải các gói…</p>}
      {plansError && (
        <p role="alert" className="mt-6 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600">
          {plansError}
        </p>
      )}
      {pro && savePct ? (
        <div className="mt-4 flex justify-end">
          <div className="relative">
            <SegTabs
              value={cycle}
              onChange={(v) => set({ hostCycle: v })}
              options={[
                { id: 'monthly', label: 'Theo tháng' },
                { id: 'annual', label: 'Theo năm' },
              ]}
            />
            <span className="absolute -top-3.5 right-0 rounded-full bg-green-600 px-2.5 py-0.5 text-[11.5px] font-bold text-white">Tiết kiệm {savePct}%</span>
          </div>
        </div>
      ) : null}
      {plans.length > 0 && (
        <div className="mt-5 grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
          {plans.map((p) => {
            const on = (p.free && form.hostPlan === 'start') || (!p.free && form.hostPlan === 'pro');
            const price = p.free ? 0 : cycle === 'annual' ? p.annualPrice : p.monthlyPrice;
            return (
              <div key={p.id} className={`relative flex flex-col overflow-hidden rounded-[18px] p-6 ${on ? 'border-2 border-brand bg-[linear-gradient(180deg,#fff,#fff7f1)] shadow-[0_14px_34px_rgba(242,106,27,.12)]' : 'border border-[#f0ebe6] bg-white'}`}>
                {p.popular && <span className="absolute -top-px -right-px rounded-[0_18px_0_12px] bg-[#ffe4d1] px-3 py-1 text-xs font-bold text-[#c2410c]">Phổ biến nhất</span>}
                <div className="flex items-center gap-3.5">
                  <span className="grid size-[52px] flex-none place-items-center rounded-[14px] bg-[#fff1e6]">
                    <MaterialIcon name={p.free ? 'send' : 'workspace_premium'} size={28} filled color={p.free ? '#f26a1b' : '#f59e0b'} />
                  </span>
                  <div>
                    <div className="text-lg font-extrabold">{p.name}</div>
                    {p.tagline && <div className="mt-0.5 text-[13px] text-stone-500">{p.tagline}</div>}
                  </div>
                </div>
                <div className="mt-5 text-[34px] font-extrabold tracking-[-1px]">
                  {formatMoney(price, p.currency)}
                  <span className="text-base font-medium tracking-normal text-stone-500"> / {!p.free && cycle === 'annual' ? 'năm' : 'tháng'}</span>
                </div>
                <ul className="m-0 mt-5 flex flex-1 list-none flex-col gap-3 p-0">
                  {p.features.map((ft) => (
                    <li key={ft} className="flex gap-2.5 text-[14.5px] leading-normal text-stone-700">
                      <MaterialIcon name="check_circle" size={20} filled color="#fb923c" />
                      {ft}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => set({ hostPlan: p.free ? 'start' : 'pro' }, ['hostCard'])}
                  className={`mt-6 h-[50px] rounded-xl text-[15px] font-bold ${on ? 'bg-brand-gradient border-0 text-white shadow-[0_8px_20px_rgba(242,106,27,.3)]' : 'border-[1.5px] border-[#fdba74] bg-white text-stone-900'}`}
                >
                  {on ? 'Đã chọn' : 'Chọn gói này'}
                </button>
              </div>
            );
          })}
          {fees && pro && (
            <div className="flex flex-col gap-3.5 rounded-[18px] border border-[#f0ebe6] bg-white p-6">
              <div className="flex items-center gap-3">
                <MaterialIcon name="bar_chart" size={28} color="#f26a1b" />
                <span className="text-lg font-extrabold">Gói nào lợi hơn?</span>
              </div>
              <label htmlFor="wz-revenue" className="text-sm text-stone-600">
                Doanh thu thành viên dự kiến mỗi tháng
              </label>
              <div className="flex h-[62px] items-center rounded-[14px] bg-[#fff1e6] px-[18px]">
                <input
                  id="wz-revenue"
                  inputMode="numeric"
                  value={rev ? rev.toLocaleString('vi-VN') : ''}
                  placeholder="0"
                  onChange={(e) => set({ revenueEstimate: parseInt(e.target.value.replace(/\D/g, ''), 10) || 0 })}
                  className="min-w-0 flex-1 border-0 bg-transparent text-[28px] font-extrabold tracking-[-0.5px] text-brand outline-0"
                />
                <MaterialIcon name="trending_up" size={26} color="#f26a1b" />
              </div>
              <CalcRow name={free?.name ?? 'Miễn phí'} rule={`Phí giao dịch ${Math.round(fees.freeFeeRate * 1000) / 10}%`} value={formatMoney(feeFree, currency)} good={feeFree <= feePro} />
              <CalcRow name={pro.name} rule={`Phí gói + ${Math.round(fees.proFeeRate * 1000) / 10}% giao dịch`} value={formatMoney(feePro, currency)} good={feePro < feeFree} />
              <div className="flex-1" />
              <div className="flex gap-3 rounded-[14px] bg-[#fff4e8] p-4 text-sm leading-normal font-bold">
                <MaterialIcon name="lightbulb" size={24} color="#f59e0b" filled />
                <span>
                  {pro.name} có lợi hơn khi doanh thu vượt {formatMoney(breakEven, currency)}/tháng.
                  {feePro < feeFree ? ` Với doanh thu này bạn tiết kiệm ${formatMoney(feeFree - feePro, currency)}/tháng.` : ''}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
      {form.hostPlan === 'pro' && pro && (
        <div className="mt-5 rounded-[18px] border border-[#f0ebe6] bg-white p-5 md:px-6">
          {cardSlot}
          {errors.hostCard && <FieldError>{errors.hostCard}</FieldError>}
          <div className="mt-4 flex gap-2.5 rounded-[14px] bg-[#ecfdf3] p-4 text-sm leading-[1.55] text-[#166534]">
            <MaterialIcon name="verified_user" size={20} color="#16a34a" filled />
            <span>
              <b>Hôm nay: {formatMoney(0, currency)}.</b>{' '}
              {pro.trialDays > 0 ? `Thử miễn phí ${pro.trialDays} ngày${trialEndLabel ? ` tới ${trialEndLabel}` : ''}. Hủy trước ngày đó, bạn không mất phí.` : 'Gói sẽ được tính phí từ kỳ đầu tiên.'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function CalcRow({ name, rule, value, good }: { name: string; rule: string; value: string; good: boolean }) {
  return (
    <div className="flex justify-between gap-2.5 text-sm">
      <div>
        <div className="text-stone-700">{name}</div>
        <div className="mt-0.5 text-xs text-stone-400">{rule}</div>
      </div>
      <span className="whitespace-nowrap text-stone-600">
        Tổng phí <b className={good ? 'text-green-700' : 'text-brand'}>{value}</b>
      </span>
    </div>
  );
}

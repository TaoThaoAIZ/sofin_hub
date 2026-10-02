import type { ReactNode } from 'react';
import { FieldError } from '../../components/ui/FieldMessage';
import { MaterialIcon } from '../../components/ui/MaterialIcon';
import { resolveApiPath } from '../../lib/api';
import { BRAND_SWATCHES, type WizardForm } from './form';
import { ImageSlot } from './ImageSlot';
import type { StepProps } from './StepBasics';
import { inputCls, WField } from './ui';

export function StepBrand({ form, set, errors }: StepProps) {
  const setBenefit = (i: number, v: string) => set({ benefits: form.benefits.map((b, k) => (k === i ? v : b)) });
  return (
    <div className="flex flex-col gap-[22px] rounded-[18px] border border-[#f0ebe6] bg-white p-[22px] shadow-[0_4px_16px_rgba(120,60,20,.04)]">
      <div className="grid gap-[18px] sm:grid-cols-[150px_minmax(0,1fr)]">
        <div>
          <div className="mb-2.5 text-[15px] font-bold">Logo cộng đồng</div>
          <ImageSlot value={form.logoUrl} onChange={(logoUrl) => set({ logoUrl })} purpose="avatar" placeholder="Tải lên logo (Vuông 1:1)" ariaLabel="Tải lên logo" />
        </div>
        <div>
          <div className="mb-2.5 text-[15px] font-bold">Ảnh bìa</div>
          <ImageSlot value={form.coverUrl} onChange={(coverUrl) => set({ coverUrl })} purpose="cover" placeholder="Kéo thả ảnh vào đây · 16:9 · tối thiểu 1280×720" ariaLabel="Tải lên ảnh bìa" />
        </div>
      </div>

      <div>
        <div className="mb-3 text-[15px] font-bold">Màu chủ đạo</div>
        <div role="radiogroup" aria-label="Màu chủ đạo" className="flex flex-wrap items-center gap-3.5">
          {BRAND_SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={form.brandColor === c}
              aria-label={`Màu ${c}`}
              onClick={() => set({ brandColor: c })}
              className="grid size-[42px] place-items-center rounded-full bg-transparent"
              style={{ border: `2px solid ${form.brandColor === c ? c : 'transparent'}` }}
            >
              <span className="size-8 rounded-full shadow-[0_2px_6px_rgba(0,0,0,.18)]" style={{ background: c }} />
            </button>
          ))}
          <label className="flex items-center gap-2 text-[13px] text-stone-500">
            Tùy chọn
            <input type="color" aria-label="Chọn màu tùy ý" value={form.brandColor} onChange={(e) => set({ brandColor: e.target.value })} className="size-8 cursor-pointer rounded-full border-0 bg-transparent p-0" />
          </label>
        </div>
      </div>

      <WField icon="edit" label="Lời hứa (dòng đầu tiên)" htmlFor="wz-promise" error={errors.promise} right={`${form.promise.length}/100`}>
        <input id="wz-promise" value={form.promise} maxLength={100} onChange={(e) => set({ promise: e.target.value }, ['promise'])} placeholder="Thành viên sẽ đạt được gì?" aria-invalid={!!errors.promise} className={`${inputCls(errors.promise)} h-[46px]`} />
      </WField>

      <div className="flex gap-4">
        <span className="grid size-10 flex-none place-items-center rounded-full bg-[#fff1e6]">
          <MaterialIcon name="star" size={20} color="#f26a1b" filled />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <div className="text-[15.5px] font-bold">{form.benefits.length} điều thành viên nhận được</div>
          {form.benefits.map((b, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <MaterialIcon name="drag_indicator" size={20} color="#c7bfb8" />
              <div className="flex h-11 min-w-0 flex-1 items-center rounded-xl border-[1.5px] border-[#e7e0da] px-3.5 focus-within:border-brand">
                <input aria-label={`Lợi ích ${i + 1}`} value={b} maxLength={100} onChange={(e) => setBenefit(i, e.target.value)} placeholder="Thêm một kết quả cụ thể..." className="min-w-0 flex-1 border-0 text-[14.5px] font-medium outline-0" />
                <span className="text-xs text-stone-400">{b.length}/100</span>
              </div>
              <button type="button" aria-label="Xóa lợi ích" onClick={() => set({ benefits: form.benefits.length > 1 ? form.benefits.filter((_, k) => k !== i) : [''] })} className="grid size-9 flex-none place-items-center rounded-[10px] border-0 bg-transparent text-stone-500 hover:bg-red-50 hover:text-red-600">
                <MaterialIcon name="delete" size={20} />
              </button>
            </div>
          ))}
          {form.benefits.length < 6 && (
            <button type="button" onClick={() => set({ benefits: [...form.benefits, ''] })} className="ml-[30px] flex h-[34px] items-center gap-1.5 self-start rounded-full border-0 bg-[#fff1e6] px-3.5 text-[13.5px] font-bold text-brand">
              + Thêm lợi ích khác
            </button>
          )}
          {errors.benefits && <FieldError>{errors.benefits}</FieldError>}
        </div>
      </div>

      <WField icon="play_circle" label="Video giới thiệu" optional htmlFor="wz-video" error={errors.videoUrl}>
        <input id="wz-video" value={form.videoUrl} onChange={(e) => set({ videoUrl: e.target.value }, ['videoUrl'])} placeholder="Dán link YouTube, Vimeo..." aria-invalid={!!errors.videoUrl} className={`${inputCls(errors.videoUrl)} h-[46px]`} />
      </WField>
    </div>
  );
}

export function CoverBox({ url, h, children }: { url: string; h: number; children?: ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-[14px] bg-[#f3e8df]" style={{ height: h }}>
      {url ? <img src={resolveApiPath(url)} alt="" className="size-full object-cover" /> : <span className="absolute inset-0 grid place-items-center text-sm text-stone-400">Ảnh bìa</span>}
      {children}
    </div>
  );
}

export function LogoBox({ url, initials }: { url: string; initials: string }) {
  return (
    <span className="grid size-11 flex-none place-items-center overflow-hidden rounded-xl bg-[linear-gradient(180deg,#fcd34d,#f59e0b)] text-base font-extrabold text-stone-900">
      {url ? <img src={resolveApiPath(url)} alt="" className="size-full object-cover" /> : initials}
    </span>
  );
}

/** Xem trước trang giới thiệu (cột phải bước 3). */
export function AboutPreview({ form, initials }: { form: WizardForm; initials: string }) {
  const filled = form.benefits.filter((b) => b.trim());
  return (
    <div className="rounded-[18px] border border-[#f0ebe6] bg-white p-4 shadow-[0_4px_16px_rgba(120,60,20,.04)] lg:sticky lg:top-24">
      <div className="mb-3 text-[15px] font-bold">Xem trước trang giới thiệu</div>
      <CoverBox url={form.coverUrl} h={190}>
        {form.videoUrl.trim() && (
          <span className="absolute top-1/2 left-1/2 grid size-[54px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white shadow-[0_8px_20px_rgba(0,0,0,.25)]">
            <MaterialIcon name="play_arrow" size={32} filled color={form.brandColor} />
          </span>
        )}
      </CoverBox>
      <div className="mt-4 flex items-center gap-3">
        <LogoBox url={form.logoUrl} initials={initials} />
        <div className="min-w-0">
          <div className="truncate text-lg font-extrabold">{form.name || 'Tên cộng đồng'}</div>
          <div className="mt-0.5 text-[12.5px] text-stone-500">{form.visibility === 'private' ? 'Riêng tư' : 'Công khai'} • 1 thành viên</div>
        </div>
      </div>
      <div className="mt-4 text-lg leading-[1.4] font-extrabold text-pretty">{form.promise || 'Lời hứa của cộng đồng sẽ hiện ở đây'}</div>
      <ul className="m-0 mt-3.5 flex list-none flex-col gap-3 p-0">
        {(filled.length ? filled : ['Lợi ích thành viên nhận được']).map((b, i) => (
          <li key={i} className="flex gap-2.5 text-sm leading-[1.45] text-stone-700">
            <MaterialIcon name="check" size={20} weight={700} color={form.brandColor} />
            {b}
          </li>
        ))}
      </ul>
      <div className="mt-5 grid h-[50px] w-full place-items-center rounded-xl text-base font-bold text-white shadow-[0_8px_20px_rgba(0,0,0,.15)]" style={{ background: form.brandColor }}>
        Tham gia
      </div>
    </div>
  );
}

/** Xem trước trên Khám phá (cột phải bước 1, 2, 4). */
export function DiscoverPreview({ form, initials, priceLabel }: { form: WizardForm; initials: string; priceLabel: string }) {
  return (
    <div className="rounded-[18px] border border-[#f0ebe6] bg-white p-4 shadow-[0_4px_16px_rgba(120,60,20,.04)] lg:sticky lg:top-24">
      <div className="mb-3 text-[15px] font-bold">Xem trước trên Khám phá</div>
      <CoverBox url={form.coverUrl} h={160}>
        <span className="pointer-events-none absolute right-2.5 bottom-2.5 rounded-full bg-stone-900/70 px-3 py-1 text-[12.5px] text-white">Ảnh bìa ở bước 3</span>
      </CoverBox>
      <div className="mt-4 flex items-center gap-3">
        <LogoBox url={form.logoUrl} initials={initials} />
        <span className="min-w-0 truncate text-[19px] font-extrabold tracking-[-0.2px]">{form.name || 'Tên cộng đồng'}</span>
      </div>
      <div className="mt-3 min-h-11 text-sm leading-[1.6] text-stone-600">{form.description || 'Mô tả ngắn sẽ hiện ở đây.'}</div>
      <div className="mt-3.5 flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-stone-600">
          <MaterialIcon name="groups" size={22} color="#f26a1b" filled />1 thành viên
        </span>
        <span className="flex items-center gap-1 font-bold">
          {priceLabel}
          <MaterialIcon name="arrow_forward" size={18} color="#f26a1b" />
        </span>
      </div>
    </div>
  );
}

import { Button } from '../../components/ui/Button';

/** Box "Tạo cộng đồng của riêng bạn" — nền ảnh cta-mockup + 2 thẻ kính nổi bên phải. */
export function CommunityCta() {
  return (
    <section className="mx-auto max-w-[1400px] px-4 pt-2 md:px-10">
      <div className="relative grid min-h-[340px] items-center gap-8 overflow-hidden rounded-[32px] bg-[linear-gradient(135deg,#fff7f0_0%,#ffe9d9_100%)] px-6 py-10 shadow-[0_24px_50px_rgba(242,106,27,.12)] md:grid-cols-2 md:px-12 md:py-11">
        <img src="/images/cta-mockup.webp" alt="" className="absolute inset-0 z-0 size-full object-cover" />
        <div className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(90deg,rgba(255,248,242,.96)_0%,rgba(255,248,242,.85)_38%,rgba(255,248,242,.25)_62%,rgba(255,248,242,0)_75%)]" />

        <div className="relative z-[1] text-stone-900">
          <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(242,106,27,.25)] bg-white/70 px-3.5 py-[7px] text-[13px] font-medium text-[#9a3d0a] backdrop-blur-[12px]">
            <span className="text-brand" aria-hidden="true">
              ✦
            </span>
            Dành cho chuyên gia, creator, doanh nghiệp
          </span>
          <h2 className="mt-[18px] mb-0 text-[clamp(28px,2.8vw,40px)] leading-[1.15] font-extrabold tracking-[-1px]">
            Tạo cộng đồng của riêng bạn
          </h2>
          <p className="mt-3.5 mb-0 max-w-[520px] text-base leading-[1.65] text-stone-600 text-pretty">
            Biến kiến thức, kinh nghiệm và tầm ảnh hưởng của bạn thành một cộng đồng học tập, cùng phát triển và tạo
            giá trị bền vững.
          </p>
          <Button className="mt-[26px] h-[52px] gap-2.5 rounded-2xl px-7 text-base font-semibold">
            Tạo cộng đồng ngay <span aria-hidden="true">→</span>
          </Button>
        </div>

        <div className="pointer-events-none relative z-[1] hidden h-[260px] md:block" aria-hidden="true">
          <div className="absolute -top-1.5 right-0 flex items-end gap-3.5 rounded-[18px] border border-white/90 bg-white/72 px-4 py-3 shadow-[0_14px_30px_rgba(0,0,0,.2)] backdrop-blur-[20px] backdrop-saturate-[180%]">
            <div>
              <div className="text-xs text-stone-600">Doanh thu tháng</div>
              <div className="text-xl font-extrabold text-stone-900">+$12,500</div>
            </div>
            <div className="flex h-[34px] items-end gap-1">
              <div className="h-3 w-1.5 rounded-[3px] bg-[#22c55e]" />
              <div className="h-5 w-1.5 rounded-[3px] bg-[#22c55e]" />
              <div className="h-[27px] w-1.5 rounded-[3px] bg-[#22c55e]" />
              <div className="h-[34px] w-1.5 rounded-[3px] bg-[#16a34a]" />
            </div>
          </div>
          <div className="absolute right-2 bottom-[18px] flex items-center gap-2 rounded-2xl border border-white/90 bg-white/78 px-[18px] py-3 text-[15px] font-semibold text-brand shadow-[0_14px_30px_rgba(0,0,0,.2)] backdrop-blur-[20px]">
            ＋ Mời thành viên
          </div>
        </div>
      </div>
    </section>
  );
}

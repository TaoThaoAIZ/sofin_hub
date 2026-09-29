import { useParams } from 'react-router-dom';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { formatCompact } from '../../../lib/format';
import { useCourseDetail } from '../../courses/queries';
import { CommunityInfoCard, initials } from './shared';

// Tên icon lấy đúng từ aboutLearn trong file thiết kế gốc (Material Symbols).
const GAIN_ICONS = ['smart_display', 'edit', 'auto_awesome', 'handshake', 'grid_view', 'forum'];

const glass = 'glass rounded-[22px]';

export function AboutTab() {
  const { id = '' } = useParams();
  const { data: course, isPending } = useCourseDetail(id);

  if (isPending || !course) return <p className="py-10 text-center text-stone-400">Đang tải…</p>;

  const chips = [
    { icon: course.visibility === 'private' ? 'lock' : 'public', t: course.visibility === 'private' ? 'Riêng tư' : 'Công khai', s: course.visibility === 'private' ? 'Chỉ thành viên' : 'Cộng đồng mở' },
    { icon: 'group', t: `${formatCompact(course.stats.members)} thành viên`, s: 'Đang hoạt động' },
    { icon: 'sell', t: course.priceUsd === 0 ? 'Miễn phí' : `$${course.priceUsd}/tháng`, s: course.priceUsd === 0 ? 'Tham gia ngay' : 'Gói thành viên' },
    { face: initials(course.instructor.name), t: `Bởi ${course.instructor.name}`, s: `${course.instructor.role} & Admin` },
  ];
  const free = [
    `${course.modules.length} module học full quy trình`,
    `${course.lessons} bài học thực chiến`,
    `Cộng đồng ${formatCompact(course.stats.members)} thành viên hoạt động`,
  ];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_336px] items-start gap-6 max-[1280px]:grid-cols-1">
      <main className="flex min-w-0 flex-col gap-4">
        <section className="relative aspect-[1235/665] overflow-hidden rounded-[26px] bg-[#140c07] shadow-[0_18px_40px_rgba(60,20,0,.25)]">
          <img src={course.thumbnail} alt={course.title} className="size-full object-cover" />
        </section>

        <div className="h-[120px] w-[130px] flex-none overflow-hidden rounded-[18px] bg-[#1c130e]">
          <img src={course.thumbnail} alt="" className="size-full object-cover" />
        </div>

        <div className="grid grid-cols-4 gap-3 max-md:grid-cols-2">
          {chips.map((c) => (
            <div key={c.t} className="glass flex min-w-0 items-center gap-3 rounded-[18px] px-4 py-3.5">
              {c.icon && <MaterialIcon name={c.icon} size={28} color="#f26a1b" />}
              {c.face && <span className="grid size-[38px] flex-none place-items-center rounded-full bg-[#e7d3c6] text-xs font-bold text-[#7c2d12]">{c.face}</span>}
              <div className="min-w-0">
                <div className="truncate text-[14.5px] font-semibold">{c.t}</div>
                <div className="mt-0.5 text-[12.5px] text-stone-500">{c.s}</div>
              </div>
            </div>
          ))}
        </div>

        <section className="rounded-[22px] border border-brand/15 bg-gradient-to-br from-[#fff3e8] to-[#ffe9d9] px-7 py-[22px]">
          <div className="max-w-[760px]">
            <div className="text-[22px] font-extrabold text-[#e8590c]">{course.title}</div>
            <p className="mt-2.5 text-[15px] leading-[1.65] text-stone-700">{course.about}</p>
          </div>
        </section>

        <section className={`${glass} px-6 py-[22px]`}>
          <div className="mb-[18px] flex items-center gap-3.5">
            <span className="grid size-[42px] place-items-center rounded-full bg-brand/10">
              <MaterialIcon name="bolt" size={24} filled color="#f26a1b" />
            </span>
            <span className="text-[21px] font-extrabold">Bạn sẽ học và nhận được gì?</span>
          </div>
          <div className="grid max-w-[900px] grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-x-7 gap-y-[18px]">
            {course.gains.map((g, i) => (
              <div key={g.title} className="flex items-center gap-[18px]">
                <span className="grid size-[60px] flex-none place-items-center rounded-2xl bg-brand/10">
                  <MaterialIcon name={GAIN_ICONS[i % GAIN_ICONS.length]!} size={28} filled color="#f26a1b" />
                </span>
                <div>
                  <div className="text-[15px] leading-normal font-semibold text-stone-800">{g.title}</div>
                  <div className="text-[13px] text-stone-500">{g.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={`${glass} px-6 pt-[22px] pb-[18px]`}>
          <div className="mb-4 flex items-center gap-3.5">
            <MaterialIcon name="menu_book" size={32} filled color="#f26a1b" />
            <span className="text-[21px] font-extrabold">Nội dung nổi bật</span>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
            <div className="rounded-[18px] border border-[#dbe8fb] bg-gradient-to-b from-[#eef5ff] to-[#f6f9ff] px-[22px] py-5">
              <div className="mb-3 flex items-center gap-3 text-[17px] font-extrabold">
                <MaterialIcon name="view_agenda" size={28} filled color="#2563eb" />
                CÓ GÌ MIỄN PHÍ?
              </div>
              {free.map((x) => (
                <div key={x} className="flex items-start gap-3 py-1 text-[14.5px] text-stone-800">
                  <MaterialIcon name="check" size={20} color="#2563eb" />
                  {x}
                </div>
              ))}
            </div>
            <div className="rounded-[18px] border border-[#fde4d2] bg-gradient-to-b from-[#fff3e8] to-[#fff8f2] px-[22px] py-5">
              <div className="mb-3 flex items-center gap-3 text-[17px] font-extrabold">
                <MaterialIcon name="crown" size={28} filled color="#f59e0b" />
                <span className="text-[#c2410c]">
                  NÂNG CẤP VIP {course.priceUsd > 0 && <span className="text-brand">(${course.priceUsd}/tháng)</span>}
                </span>
              </div>
              {course.priceNotes.map((x) => (
                <div key={x} className="flex items-start gap-3 py-1 text-[14.5px] text-stone-800">
                  <MaterialIcon name="check" size={20} color="#f26a1b" />
                  {x}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-full bg-[#e7d3c6] text-xs font-bold text-[#7c2d12]">{initials(course.instructor.name)}</span>
              <span className="text-[15px]">Founder: {course.instructor.name}</span>
            </div>
            <div className="ml-auto flex items-center gap-2 text-[13px] text-stone-700">
              <MaterialIcon name="redeem" size={20} filled color="#f26a1b" />
              Tham gia → Làm Module 1 hôm nay → Post kết quả đầu tiên trong 30 ngày.
            </div>
          </div>
        </section>
      </main>

      <CommunityInfoCard course={course} coverHeight={170} />
    </div>
  );
}

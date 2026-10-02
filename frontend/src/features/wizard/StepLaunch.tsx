import { Link } from 'react-router-dom';
import { Button, ButtonLink } from '../../components/ui/Button';
import { MaterialIcon } from '../../components/ui/MaterialIcon';
import type { LaunchChecklist } from './types';
import { CheckRow } from './ui';

export interface SummaryRow {
  label: string;
  value: string;
  step: number;
}

/** Bước 5 (trước khi ra mắt): tóm tắt để kiểm tra lại + đồng ý điều khoản. */
export function StepSummary({
  rows,
  onEdit,
  terms,
  onTerms,
  termsError,
  missing,
}: {
  rows: SummaryRow[];
  onEdit: (step: number) => void;
  terms: boolean;
  onTerms: (v: boolean) => void;
  termsError?: string;
  missing: { step: string; field: string; message: string }[];
}) {
  return (
    <div className="rounded-[18px] border border-[#f0ebe6] bg-white p-[22px] shadow-[0_4px_16px_rgba(120,60,20,.04)]">
      <div className="flex flex-col">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3.5 border-b border-[#f3eee9] py-3">
            <span className="w-[130px] flex-none text-[13.5px] text-stone-500 max-sm:w-[100px]">{r.label}</span>
            <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold">{r.value}</span>
            <button type="button" onClick={() => onEdit(r.step)} className="border-0 bg-transparent text-[13px] font-semibold text-brand">
              Sửa
            </button>
          </div>
        ))}
      </div>
      {missing.length > 0 && (
        <ul role="alert" className="m-0 mt-4 list-none rounded-xl bg-red-50 p-3 text-[13px] font-medium text-red-700">
          {missing.map((m) => (
            <li key={`${m.step}-${m.field}`}>{m.message}</li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-x-3">
        <CheckRow checked={terms} onChange={onTerms} error={termsError}>
          Tôi đồng ý với Điều khoản dành cho chủ cộng đồng
        </CheckRow>
        <Link to="/terms" target="_blank" className="text-[13px] font-semibold text-brand underline">
          Xem điều khoản
        </Link>
      </div>
    </div>
  );
}

const ITEM_UI: Record<string, { icon: string; title: string; sub: string; btn?: string; to?: (id: string) => string; action?: 'copy' }> = {
  created: { icon: 'task_alt', title: 'Tạo cộng đồng & chọn gói', sub: 'Hoàn tất bước tạo cộng đồng' },
  identity: { icon: 'task_alt', title: 'Logo, ảnh bìa & trang giới thiệu', sub: 'Cộng đồng có nhận diện riêng', btn: 'Cập nhật', to: (id) => `/communities/${id}/community/cai-dat` },
  payout: { icon: 'account_balance_wallet', title: 'Kết nối tài khoản nhận tiền', sub: 'Cần có để rút doanh thu từ cộng đồng trả phí', btn: 'Kết nối', to: (id) => `/communities/${id}/community/cai-dat` },
  first_lesson: { icon: 'menu_book', title: 'Thêm bài học đầu tiên', sub: 'Một học phần hoàn chỉnh tốt hơn mười học phần trống', btn: 'Mở Lớp học', to: (id) => `/communities/${id}/community/lop-hoc` },
  welcome_post: { icon: 'edit', title: 'Viết bài chào mừng & ghim lên đầu', sub: 'Kèm một câu hỏi để thành viên mới trả lời ngay', btn: 'Viết bài', to: (id) => `/communities/${id}/community` },
  invite_members: { icon: 'group', title: 'Mời 10 thành viên đầu tiên', sub: 'Bạn bè, khách cũ, người theo dõi trên mạng xã hội', btn: 'Mời', action: 'copy' },
};

const CONDITION_TITLE: Record<string, string> = {
  has_description_and_promise: 'Có mô tả & trang giới thiệu',
  has_cover: 'Có ảnh bìa',
  min_members: 'Ít nhất {n} thành viên',
  recent_post: 'Có bài đăng trong 7 ngày qua',
};

/** Sau khi ra mắt: "Cộng đồng đã sẵn sàng!" + danh sách ra mắt + link mời + điều kiện lên Khám phá (đều từ BE). */
export function LaunchView({
  name,
  communityId,
  inviteUrl,
  checklist,
  loading,
  error,
  onCopy,
}: {
  name: string;
  communityId: string;
  inviteUrl: string;
  checklist?: LaunchChecklist;
  loading: boolean;
  error?: string;
  onCopy: () => void;
}) {
  const total = checklist?.total ?? 6;
  const done = checklist?.doneCount ?? 0;
  return (
    <div>
      <div className="flex flex-wrap items-start gap-6">
        <div className="min-w-[280px] flex-1">
          <span className="inline-flex h-[34px] items-center gap-1.5 rounded-full bg-green-100 px-3.5 text-sm font-bold text-green-700">
            <MaterialIcon name="check" size={18} />
            Đã tạo cộng đồng
          </span>
          <h1 className="mt-4 mb-0 text-[clamp(28px,3vw,40px)] leading-[1.15] font-extrabold tracking-[-0.03em]">
            {name} <span className="text-brand">đã sẵn sàng!</span>
          </h1>
          <p className="mt-2 mb-0 max-w-[640px] text-[15.5px] leading-relaxed text-stone-600 text-pretty">
            Cộng đồng đã hoạt động. Hoàn thành các việc dưới đây trước khi mời người đầu tiên – thành viên mới thấy lớp trống sẽ rời đi rất nhanh.
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <MaterialIcon name="celebration" size={72} color="#f59e0b" filled />
          <ButtonLink to={`/communities/${communityId}/community`} className="h-[50px] gap-2 rounded-xl px-6 text-[15.5px] font-bold">
            Vào cộng đồng
            <MaterialIcon name="arrow_forward" size={19} color="#fff" />
          </ButtonLink>
        </div>
      </div>

      <div className="mt-6 grid items-start gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,1fr)]">
        <section className="rounded-[18px] border border-[#f0ebe6] bg-white p-5 shadow-[0_4px_16px_rgba(120,60,20,.04)]">
          <div className="flex items-center gap-3">
            <span className="grid size-[38px] place-items-center rounded-full bg-[#fff1e6]">
              <MaterialIcon name="storefront" size={20} color="#f26a1b" filled />
            </span>
            <span className="flex-1 text-[17px] font-extrabold">Danh sách ra mắt</span>
            <span className="text-[15px] text-stone-500">
              {done} / {total} xong
            </span>
          </div>
          <div className="mt-4 mb-1.5 h-[7px] overflow-hidden rounded-full bg-[#efeae6]">
            <div className="h-full rounded-full bg-[linear-gradient(90deg,#ff8f45,#f26a1b)] transition-[width]" style={{ width: `${(done / total) * 100}%` }} />
          </div>
          {loading && <p className="text-sm text-stone-500">Đang tải danh sách…</p>}
          {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}
          {checklist?.items.map((it) => {
            const ui = ITEM_UI[it.key];
            if (!ui) return null;
            return (
              <div key={it.key} className="flex items-center gap-3.5 border-b border-[#f3eee9] py-3.5 last:border-b-0">
                <MaterialIcon name={it.done ? 'check_circle' : 'radio_button_unchecked'} size={26} filled={it.done} color={it.done ? '#16a34a' : '#d6d3d1'} />
                <span className={`grid size-[46px] flex-none place-items-center rounded-xl ${it.done ? 'bg-green-100 text-green-600' : 'bg-[#fff1e6] text-brand'}`}>
                  <MaterialIcon name={ui.icon} size={22} filled />
                </span>
                <div className="min-w-0 flex-1">
                  <div className={`text-[15px] font-bold ${it.done ? 'text-stone-600 line-through' : ''}`}>
                    {it.key === 'invite_members' && it.required ? `Mời ${it.required} thành viên đầu tiên` : ui.title}
                  </div>
                  <div className="mt-0.5 text-[13px] leading-normal text-stone-500">
                    {ui.sub}
                    {it.key === 'invite_members' && it.required ? ` · ${it.current ?? 0}/${it.required}` : ''}
                  </div>
                </div>
                {!it.done && ui.btn && (ui.to ? (
                  <Link to={ui.to(communityId)} className="flex h-[42px] items-center rounded-xl border-[1.5px] border-[#e7e0da] bg-white px-4 text-[13.5px] font-bold whitespace-nowrap hover:border-[#fdba74] hover:bg-[#fffaf6]">
                    {ui.btn}
                  </Link>
                ) : (
                  <button type="button" onClick={onCopy} className="h-[42px] rounded-xl border-[1.5px] border-[#e7e0da] bg-white px-4 text-[13.5px] font-bold whitespace-nowrap hover:border-[#fdba74] hover:bg-[#fffaf6]">
                    {ui.btn}
                  </button>
                ))}
              </div>
            );
          })}
        </section>

        <div className="flex flex-col gap-4">
          <section className="rounded-[18px] border border-[#f0ebe6] bg-white p-5 shadow-[0_4px_16px_rgba(120,60,20,.04)]">
            <div className="mb-4 flex items-center gap-3">
              <span className="grid size-[38px] place-items-center rounded-full bg-[#fff1e6]">
                <MaterialIcon name="link" size={20} color="#f26a1b" />
              </span>
              <span className="text-[17px] font-extrabold">Link mời</span>
            </div>
            <div className="flex gap-2.5">
              <div className="flex h-12 min-w-0 flex-1 items-center overflow-hidden rounded-xl bg-[#f5f2ef] px-3.5 text-[14.5px] text-ellipsis whitespace-nowrap" title={inviteUrl}>
                {inviteUrl.replace(/^https?:\/\//, '')}
              </div>
              <Button onClick={onCopy} variant="brand" className="h-12 gap-1.5 rounded-xl px-3.5 text-[13px] font-bold">
                <MaterialIcon name="content_copy" size={18} color="#fff" />
                Sao chép link mời
              </Button>
            </div>
          </section>
          <section className="rounded-[18px] border border-[#f0ebe6] bg-white p-5 shadow-[0_4px_16px_rgba(120,60,20,.04)]">
            <div className="mb-2.5 flex items-center gap-3">
              <span className="grid size-[38px] place-items-center rounded-full bg-[#fff1e6]">
                <MaterialIcon name="rocket_launch" size={20} color="#f26a1b" filled />
              </span>
              <span className="text-[17px] font-extrabold">Lên trang Khám phá</span>
            </div>
            <div className="mb-2 text-sm text-stone-600">Cộng đồng được đề xuất khi đủ các điều kiện:</div>
            {checklist?.discovery.conditions.map((c) => (
              <div key={c.key} className="flex items-center gap-3 py-2 text-[15px]">
                <MaterialIcon name={c.met ? 'check_circle' : 'radio_button_unchecked'} size={26} filled={c.met} color={c.met ? '#16a34a' : '#d6d3d1'} />
                <span className="flex-1">{(CONDITION_TITLE[c.key] ?? c.key).replace('{n}', String(c.required ?? ''))}</span>
                {c.required ? <span className="text-[13.5px] text-stone-500">{c.current ?? 0}/{c.required}</span> : null}
              </div>
            ))}
            {checklist && (
              <p className="mt-2 mb-0 text-[13px] text-stone-500">
                {checklist.discovery.eligible ? 'Cộng đồng của bạn đã đủ điều kiện để được đề xuất.' : 'Hoàn thành các điều kiện còn lại để tăng cơ hội được đề xuất.'}
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

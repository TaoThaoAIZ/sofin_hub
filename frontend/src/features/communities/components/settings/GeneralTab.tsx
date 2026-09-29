import { useState, type ReactNode } from 'react';
import { Button } from '../../../../components/ui/Button';
import { useCategories } from '../../../courses/queries';
import type { CategoryId, CourseDetail, Language, Visibility } from '../../../courses/types';
import { useUpdateCommunity } from '../../queries';
import { ROLE_RANK, type UpdateCommunityInput, type ViewerRole } from '../../types';
import { ErrorLine, errorText, INPUT_CLASS } from '../Modal';

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13.5px] font-semibold text-stone-800">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-stone-500">{hint}</span>}
    </label>
  );
}

/** Thông tin chung (admin+). Giá & chế độ riêng tư chỉ Owner/Platform Admin sửa được (BE cũng chặn). */
export function GeneralTab({ course, viewerRole }: { course: CourseDetail; viewerRole: ViewerRole }) {
  const { data: categories = [] } = useCategories();
  const update = useUpdateCommunity(course.id);
  const isOwner = ROLE_RANK[viewerRole] >= ROLE_RANK.owner;

  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description);
  const [thumbnail, setThumbnail] = useState(course.thumbnail);
  const [category, setCategory] = useState<CategoryId>(course.category);
  const [language, setLanguage] = useState<Language>(course.language);
  const [visibility, setVisibility] = useState<Visibility>(course.visibility);
  const [priceText, setPriceText] = useState(String(course.priceUsd));
  const [localError, setLocalError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = () => {
    setSaved(false);
    const price = Number(priceText);
    if (title.trim().length < 3 || title.trim().length > 80) return setLocalError('Tên cộng đồng phải từ 3 đến 80 ký tự');
    if (!description.trim()) return setLocalError('Vui lòng nhập mô tả');
    if (isOwner && (priceText.trim() === '' || !Number.isFinite(price) || price < 0 || price > 10000)) {
      return setLocalError('Giá phải là số từ 0 đến 10.000');
    }
    setLocalError(null);

    // Chỉ gửi những trường thực sự thay đổi (tránh đụng quyền owner-only khi admin lưu).
    const patch: UpdateCommunityInput = {};
    if (title.trim() !== course.title) patch.title = title.trim();
    if (description.trim() !== course.description) patch.description = description.trim();
    if (thumbnail.trim() && thumbnail.trim() !== course.thumbnail) patch.thumbnail = thumbnail.trim();
    if (category !== course.category) patch.category = category;
    if (language !== course.language) patch.language = language;
    if (isOwner && visibility !== course.visibility) patch.visibility = visibility;
    if (isOwner && price !== course.priceUsd) patch.priceUsd = price;
    if (Object.keys(patch).length === 0) return setLocalError('Chưa có thay đổi nào để lưu');

    update.mutate(patch, { onSuccess: () => setSaved(true) });
  };

  return (
    <section className="glass flex flex-col gap-5 rounded-[26px] p-6">
      <h2 className="m-0 text-lg font-extrabold">Thông tin chung</h2>
      <Field label="Tên cộng đồng">
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} className={INPUT_CLASS} />
      </Field>
      <Field label="Mô tả">
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={5} className={`${INPUT_CLASS} resize-none`} />
      </Field>
      <Field label="Ảnh bìa (URL)">
        <input value={thumbnail} onChange={(e) => setThumbnail(e.target.value)} maxLength={500} className={INPUT_CLASS} />
      </Field>
      {thumbnail.trim() && (
        <div className="aspect-[16/6] max-w-[420px] overflow-hidden rounded-2xl bg-stone-100">
          <img src={thumbnail.trim()} alt="Xem trước ảnh bìa" className="size-full object-cover" />
        </div>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Danh mục">
          <select value={category} onChange={(e) => setCategory(e.target.value as CategoryId)} className={INPUT_CLASS}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Ngôn ngữ">
          <select value={language} onChange={(e) => setLanguage(e.target.value as Language)} className={INPUT_CLASS}>
            <option value="vi">Tiếng Việt</option>
            <option value="en">English</option>
          </select>
        </Field>
      </div>

      <div className="rounded-2xl border border-[rgba(120,60,20,.1)] bg-white/60 p-4">
        <div className="text-[15px] font-bold">Giá & chế độ hiển thị</div>
        {isOwner ? (
          <div className="mt-3 grid gap-5 sm:grid-cols-2">
            <Field label="Chế độ hiển thị">
              <select value={visibility} onChange={(e) => setVisibility(e.target.value as Visibility)} className={INPUT_CLASS}>
                <option value="public">Công khai</option>
                <option value="private">Riêng tư (cần duyệt yêu cầu)</option>
              </select>
            </Field>
            <Field label="Giá (USD / tháng)" hint="0 = miễn phí. Thay đổi giá có thể ảnh hưởng người tham gia mới.">
              <input value={priceText} onChange={(e) => setPriceText(e.target.value)} inputMode="decimal" className={INPUT_CLASS} />
            </Field>
          </div>
        ) : (
          <p className="mt-2 text-sm text-stone-600">
            Hiện tại: <b>{course.visibility === 'private' ? 'Riêng tư' : 'Công khai'}</b> ·{' '}
            <b>{course.priceUsd === 0 ? 'Miễn phí' : `$${course.priceUsd}/tháng`}</b>. Chỉ chủ cộng đồng mới đổi được giá và chế độ riêng tư.
          </p>
        )}
      </div>

      {localError && <ErrorLine>{localError}</ErrorLine>}
      {update.isError && <ErrorLine>{errorText(update.error)}</ErrorLine>}
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={update.isPending} className="h-11 rounded-xl px-6 text-sm font-bold">
          {update.isPending ? 'Đang lưu…' : 'Lưu thay đổi'}
        </Button>
        {saved && !update.isPending && !localError && <span className="text-sm text-green-700">Đã lưu thay đổi</span>}
      </div>
    </section>
  );
}

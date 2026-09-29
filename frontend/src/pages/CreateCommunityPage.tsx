import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Footer } from '../components/layout/Footer';
import { Header } from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { MaterialIcon } from '../components/ui/MaterialIcon';
import { useAuth } from '../features/auth/AuthContext';
import { ErrorLine, errorText, INPUT_CLASS } from '../features/communities/components/Modal';
import { useCreateCommunity } from '../features/communities/queries';
import { useCategories } from '../features/courses/queries';
import type { CategoryId, Language, Visibility } from '../features/courses/types';

const STEPS = ['Thông tin', 'Loại & giá', 'Ảnh bìa & xác nhận'];

const LANGUAGES: { key: Language; label: string }[] = [
  { key: 'vi', label: 'Tiếng Việt' },
  { key: 'en', label: 'English' },
];

const VISIBILITY_OPTIONS: { key: Visibility; icon: string; title: string; desc: string }[] = [
  { key: 'public', icon: 'public', title: 'Công khai', desc: 'Ai cũng có thể tìm thấy và tham gia ngay.' },
  { key: 'private', icon: 'lock', title: 'Riêng tư', desc: 'Người muốn tham gia phải gửi yêu cầu để bạn duyệt.' },
];

export function CreateCommunityPage() {
  const navigate = useNavigate();
  const { status } = useAuth();
  const { data: categories = [] } = useCategories();
  const create = useCreateCommunity();

  const [step, setStep] = useState(0);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<CategoryId | ''>('');
  const [language, setLanguage] = useState<Language>('vi');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [priceText, setPriceText] = useState('0');
  const [thumbnail, setThumbnail] = useState('');
  const [thumbBroken, setThumbBroken] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);

  // Cần đăng nhập để tạo cộng đồng: chuyển sang đăng nhập rồi quay lại đúng trang này.
  useEffect(() => {
    if (status === 'guest') navigate('/login', { replace: true, state: { from: '/communities/new' } });
  }, [status, navigate]);

  const price = Number(priceText);
  const priceValid = priceText.trim() !== '' && Number.isFinite(price) && price >= 0 && price <= 10000;

  const validate = (s: number): string | null => {
    if (s === 0) {
      if (title.trim().length < 3) return 'Tên cộng đồng tối thiểu 3 ký tự';
      if (title.trim().length > 80) return 'Tên cộng đồng tối đa 80 ký tự';
      if (!description.trim()) return 'Vui lòng nhập mô tả';
      if (!category) return 'Vui lòng chọn danh mục';
    }
    if (s === 1 && !priceValid) return 'Giá phải là số từ 0 đến 10.000 (0 = miễn phí)';
    return null;
  };

  const next = () => {
    const err = validate(step);
    setStepError(err);
    if (!err) setStep(step + 1);
  };

  const submit = () => {
    const err = validate(0) ?? validate(1);
    if (err || !category) {
      setStepError(err);
      return;
    }
    setStepError(null);
    create.mutate(
      {
        title: title.trim(),
        description: description.trim(),
        category,
        language,
        visibility,
        priceUsd: price,
        thumbnail: thumbnail.trim() || undefined,
      },
      { onSuccess: (course) => navigate(`/courses/${course.id}/community`) },
    );
  };

  return (
    <div
      className="min-h-screen pb-16"
      style={{
        background:
          'radial-gradient(700px 500px at 0% 20%, rgba(255,186,140,.3), transparent 70%), radial-gradient(700px 600px at 100% 30%, rgba(251,207,232,.28), transparent 70%), #fff',
      }}
    >
      <Header active="Cộng đồng" />
      <div className="mx-auto max-w-[720px] px-4 pt-8">
        <h1 className="m-0 text-[clamp(26px,3vw,34px)] font-extrabold tracking-[-0.5px]">Tạo cộng đồng của bạn</h1>
        <p className="mt-1.5 text-[15px] text-stone-600">Chỉ mất vài bước. Bạn sẽ là chủ cộng đồng và có thể chỉnh sửa mọi thứ sau.</p>

        <ol className="mt-6 flex items-center gap-2 max-sm:flex-col max-sm:items-stretch">
          {STEPS.map((label, i) => (
            <li
              key={label}
              className={`flex flex-1 items-center gap-2.5 rounded-2xl border px-3.5 py-2.5 text-sm ${
                i === step ? 'border-brand/40 bg-brand-soft font-bold text-brand' : i < step ? 'border-green-200 bg-green-50 font-semibold text-green-700' : 'border-[rgba(120,60,20,.1)] bg-white/60 text-stone-500'
              }`}
            >
              <span className={`grid size-6 flex-none place-items-center rounded-full text-xs font-bold ${i === step ? 'bg-brand text-white' : i < step ? 'bg-green-600 text-white' : 'bg-stone-200 text-stone-600'}`}>
                {i < step ? '✓' : i + 1}
              </span>
              {label}
            </li>
          ))}
        </ol>

        <div className="glass mt-5 flex flex-col gap-5 rounded-[26px] p-6">
          {step === 0 && (
            <>
              <Field label="Tên cộng đồng" hint={`${title.length}/80`}>
                <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Ví dụ: Marketing thực chiến" className={INPUT_CLASS} />
              </Field>
              <Field label="Mô tả" hint={`${description.length}/2000`}>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={2000}
                  rows={5}
                  placeholder="Cộng đồng này dành cho ai và mọi người sẽ nhận được gì?"
                  className={`${INPUT_CLASS} resize-none`}
                />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Danh mục">
                  <select value={category} onChange={(e) => setCategory(e.target.value as CategoryId | '')} className={INPUT_CLASS}>
                    <option value="">Chọn danh mục…</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Ngôn ngữ">
                  <select value={language} onChange={(e) => setLanguage(e.target.value as Language)} className={INPUT_CLASS}>
                    {LANGUAGES.map((l) => (
                      <option key={l.key} value={l.key}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <Field label="Chế độ hiển thị" group>
                <div className="grid gap-3 sm:grid-cols-2" role="radiogroup">
                  {VISIBILITY_OPTIONS.map((o) => (
                    <button
                      key={o.key}
                      type="button"
                      role="radio"
                      aria-checked={visibility === o.key}
                      onClick={() => setVisibility(o.key)}
                      className={`flex flex-col items-start gap-1.5 rounded-2xl border-2 p-4 text-left ${
                        visibility === o.key ? 'border-brand bg-brand-soft' : 'border-[rgba(120,60,20,.12)] bg-white/70 hover:bg-white'
                      }`}
                    >
                      <MaterialIcon name={o.icon} size={26} color={visibility === o.key ? '#f26a1b' : '#57534e'} />
                      <span className="text-[15px] font-bold">{o.title}</span>
                      <span className="text-[13px] leading-snug text-stone-600">{o.desc}</span>
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Giá thành viên (USD / tháng)" hint="Nhập 0 nếu miễn phí. Bạn có thể đổi sau trong phần Cài đặt.">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-stone-500">$</span>
                  <input
                    value={priceText}
                    onChange={(e) => setPriceText(e.target.value)}
                    inputMode="decimal"
                    className={`${INPUT_CLASS} max-w-[180px]`}
                    aria-label="Giá mỗi tháng (USD)"
                  />
                  <span className="text-sm text-stone-600">{priceValid && price === 0 ? 'Miễn phí' : '/ tháng'}</span>
                </div>
              </Field>
            </>
          )}

          {step === 2 && (
            <>
              <Field label="Ảnh bìa (đường dẫn ảnh, không bắt buộc)" hint="Bỏ trống sẽ dùng ảnh mặc định. Dán URL ảnh bắt đầu bằng https://…">
                <input
                  value={thumbnail}
                  onChange={(e) => {
                    setThumbnail(e.target.value);
                    setThumbBroken(false);
                  }}
                  maxLength={500}
                  placeholder="https://…/anh-bia.jpg"
                  className={INPUT_CLASS}
                />
              </Field>
              {thumbnail.trim() && (
                <div className="aspect-[16/7] overflow-hidden rounded-2xl bg-stone-100">
                  {thumbBroken ? (
                    <div className="grid size-full place-items-center text-sm text-stone-500">Không tải được ảnh từ đường dẫn này</div>
                  ) : (
                    <img src={thumbnail.trim()} alt="Xem trước ảnh bìa" onError={() => setThumbBroken(true)} className="size-full object-cover" />
                  )}
                </div>
              )}
              <div className="rounded-2xl border border-[rgba(120,60,20,.1)] bg-white/70 p-4 text-sm">
                <div className="text-[15px] font-bold">Xác nhận thông tin</div>
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
                  <dt className="text-stone-500">Tên</dt>
                  <dd className="font-semibold break-words">{title.trim()}</dd>
                  <dt className="text-stone-500">Danh mục</dt>
                  <dd>{categories.find((c) => c.id === category)?.name ?? category}</dd>
                  <dt className="text-stone-500">Ngôn ngữ</dt>
                  <dd>{LANGUAGES.find((l) => l.key === language)?.label}</dd>
                  <dt className="text-stone-500">Hiển thị</dt>
                  <dd>{visibility === 'private' ? 'Riêng tư' : 'Công khai'}</dd>
                  <dt className="text-stone-500">Giá</dt>
                  <dd>{price === 0 ? 'Miễn phí' : `$${price}/tháng`}</dd>
                </dl>
              </div>
            </>
          )}

          {stepError && <ErrorLine>{stepError}</ErrorLine>}
          {create.isError && <ErrorLine>{errorText(create.error)}</ErrorLine>}

          <div className="flex items-center justify-between gap-3">
            {step === 0 ? (
              <Link to="/" className="text-sm font-semibold text-stone-600 hover:text-brand">
                Hủy
              </Link>
            ) : (
              <button
                type="button"
                disabled={create.isPending}
                onClick={() => {
                  setStepError(null);
                  setStep(step - 1);
                }}
                className="h-11 rounded-xl border border-[rgba(120,60,20,.15)] bg-white px-5 text-sm font-semibold text-stone-700"
              >
                Quay lại
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <Button onClick={next} className="h-11 rounded-xl px-6 text-sm font-bold">
                Tiếp tục
              </Button>
            ) : (
              <Button onClick={submit} disabled={create.isPending || status !== 'authenticated'} className="h-11 rounded-xl px-6 text-sm font-bold">
                {create.isPending ? 'Đang tạo…' : 'Tạo cộng đồng'}
              </Button>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

function Field({ label, hint, group, children }: { label: string; hint?: string; group?: boolean; children: ReactNode }) {
  const Wrapper = group ? 'div' : 'label';
  return (
    <Wrapper className="block">
      <span className="mb-1.5 block text-[13.5px] font-semibold text-stone-800">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-stone-500">{hint}</span>}
    </Wrapper>
  );
}

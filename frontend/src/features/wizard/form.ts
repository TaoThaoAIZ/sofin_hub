/** Trạng thái form của wizard tạo cộng đồng (BE là nguồn sự thật: mỗi bước lưu vào bản nháp qua PATCH). */
export interface WizardRule {
  title: string;
  body: string;
}

export interface WizardForm {
  // Bước 1 — basics
  name: string;
  slug: string;
  slugTouched: boolean;
  description: string;
  category: string;
  // Bước 2 — plan (gói hosting của chủ cộng đồng)
  hostPlan: 'start' | 'pro';
  hostCycle: 'monthly' | 'annual';
  revenueEstimate: number;
  // Bước 3 — identity
  logoUrl: string;
  coverUrl: string;
  brandColor: string;
  promise: string;
  benefits: string[];
  videoUrl: string;
  // Bước 4 — members
  visibility: 'public' | 'private';
  billing: 'free' | 'month' | 'year';
  priceMonthly: string;
  priceAnnual: string;
  trialEnabled: boolean;
  questions: string[];
  rules: WizardRule[];
  rulesRequireAgreement: boolean;
  rulesAutoApprovePaid: boolean;
  // Bước 5
  terms: boolean;
}

export const STEP_LABELS = ['Thông tin cơ bản', 'Chọn gói & dùng thử', 'Nhận diện & giới thiệu', 'Thành viên & giá', 'Ra mắt'] as const;
export const STEP_KEYS = ['basics', 'plan', 'identity', 'members'] as const;
export type StepKey = (typeof STEP_KEYS)[number];

export const BRAND_SWATCHES = ['#f26a1b', '#16a34a', '#2563eb', '#7c3aed', '#ec4899', '#111111'] as const;

export const MAX_PRICE_USD = 10000;
export const MAX_QUESTIONS = 3;

export const defaultForm = (): WizardForm => ({
  name: '',
  slug: '',
  slugTouched: false,
  description: '',
  category: '',
  hostPlan: 'start',
  hostCycle: 'monthly',
  revenueEstimate: 0,
  logoUrl: '',
  coverUrl: '',
  brandColor: BRAND_SWATCHES[0],
  promise: '',
  benefits: ['', '', ''],
  videoUrl: '',
  visibility: 'public',
  billing: 'free',
  priceMonthly: '',
  priceAnnual: '',
  trialEnabled: true,
  questions: [],
  rules: [],
  rulesRequireAgreement: true,
  rulesAutoApprovePaid: true,
  terms: false,
});

export type FieldErrors = Partial<Record<string, string>>;

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const parseMoney = (s: string): number => {
  if (!s.trim()) return NaN;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};

const isUrl = (s: string) => {
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

export interface ValidateCtx {
  /** Kết quả kiểm tra slug từ server: false = đã có người dùng. undefined = chưa biết. */
  slugAvailable?: boolean;
  slugChecking?: boolean;
  /** Thẻ cho gói Chuyên nghiệp: đã có thẻ lưu ở nháp hoặc đã nhập hợp lệ. */
  hostCardReady: boolean;
}

/** Kiểm tra từng bước ở client → lỗi theo tên trường (viền đỏ + dòng báo lỗi dưới ô, xoá khi sửa). BE vẫn kiểm tra lại. */
export function validateStep(step: number, f: WizardForm, ctx: ValidateCtx): FieldErrors {
  const e: FieldErrors = {};
  if (step === 0) {
    const name = f.name.trim();
    if (name.length < 3) e.name = 'Tên cộng đồng tối thiểu 3 ký tự';
    else if (name.length > 30) e.name = 'Tên cộng đồng tối đa 30 ký tự';
    if (!f.slug) e.slug = 'Vui lòng nhập đường dẫn';
    else if (f.slug.length < 3) e.slug = 'Đường dẫn tối thiểu 3 ký tự';
    else if (!SLUG_RE.test(f.slug)) e.slug = 'Chỉ dùng chữ thường, số và dấu gạch ngang';
    else if (ctx.slugAvailable === false) e.slug = 'Đường dẫn này đã có người dùng';
    else if (ctx.slugChecking) e.slug = 'Đang kiểm tra đường dẫn, vui lòng đợi giây lát';
    if (!f.description.trim()) e.description = 'Vui lòng nhập mô tả ngắn';
    if (!f.category) e.category = 'Vui lòng chọn danh mục';
  }
  if (step === 1 && f.hostPlan === 'pro' && !ctx.hostCardReady) {
    e.hostCard = 'Vui lòng nhập thông tin thẻ để bắt đầu dùng thử';
  }
  if (step === 2) {
    if (f.promise.trim().length > 100) e.promise = 'Lời hứa tối đa 100 ký tự';
    if (f.videoUrl.trim() && !isUrl(f.videoUrl.trim())) e.videoUrl = 'Đường dẫn video không hợp lệ (dán link YouTube hoặc Vimeo)';
  }
  if (step === 3) {
    if (f.billing !== 'free') {
      const m = parseMoney(f.priceMonthly);
      if (!(m > 0)) e.priceMonthly = 'Nhập giá thành viên hàng tháng lớn hơn 0';
      else if (m > MAX_PRICE_USD) e.priceMonthly = `Giá tối đa ${MAX_PRICE_USD.toLocaleString('en-US')} USD`;
      if (f.billing === 'year') {
        const a = parseMoney(f.priceAnnual);
        if (!(a > 0)) e.priceAnnual = 'Nhập giá thành viên hàng năm lớn hơn 0';
        else if (m > 0 && a > m * 12) e.priceAnnual = 'Giá năm không được cao hơn 12 tháng cộng lại';
      }
    }
    f.questions.forEach((q, i) => {
      const t = q.trim();
      if (t.length < 3) e[`question-${i}`] = 'Câu hỏi tối thiểu 3 ký tự (hoặc xóa câu hỏi này)';
      else if (t.length > 200) e[`question-${i}`] = 'Câu hỏi tối đa 200 ký tự';
    });
  }
  if (step === 4 && !f.terms) e.terms = 'Bạn cần đồng ý với Điều khoản dành cho chủ cộng đồng';
  return e;
}

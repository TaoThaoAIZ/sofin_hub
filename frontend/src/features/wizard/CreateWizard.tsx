import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { CardFields } from '../../components/ui/CardFields';
import { MaterialIcon } from '../../components/ui/MaterialIcon';
import { formatMoney } from '../../lib/format';
import { toPaymentMethodInput, tokenizeCard, validateCard, type CardErrors, type CardForm } from '../../lib/card';
import { useDebounced } from '../../lib/useDebounced';
import { ApiError } from '../../lib/api';
import { useCategories } from '../courses/queries';
import * as api from './api';
import {
  defaultForm,
  MAX_QUESTIONS,
  parseMoney,
  SLUG_RE,
  slugify,
  STEP_LABELS,
  validateStep,
  type FieldErrors,
  type WizardForm,
} from './form';
import { basicsBody, FIELD_STEP, formFromDraft, identityBody, membersBody, serverFieldErrors } from './mapping';
import { useCreateDraft, useDraft, useLaunchChecklist, useOwnerPlans, usePatchDraftStep, usePayoutAccount, usePublishDraft, useRevenueEstimate, useRulesTemplate } from './queries';
import { StepBasics, type SlugStatus } from './StepBasics';
import { AboutPreview, DiscoverPreview, StepBrand } from './StepBrand';
import { StepHostPlan } from './StepHostPlan';
import { LaunchView, StepSummary, type SummaryRow } from './StepLaunch';
import { StepMembers, type PayoutValues } from './StepMembers';
import type { DraftView, FeeInfo, HostPlanInfo, PayoutInfo, PublishedCommunity } from './types';

const HEAD: { a: string; b: string; c?: string; lead: string }[] = [
  { a: 'Cộng đồng của bạn', b: 'tên là gì?', lead: 'Đặt tên theo kết quả thành viên nhận được, không phải theo tên bạn – người lạ tìm thấy bạn dễ hơn trên trang Khám phá.' },
  { a: 'Dùng thử', b: '{n} ngày', c: ', chưa trừ đồng nào', lead: 'Chọn gói bạn muốn tiếp tục sau thời gian dùng thử. Chúng tôi nhắc bạn trước khi hết hạn.' },
  { a: 'Để người lạ hiểu ngay', b: 'vì sao nên tham gia', lead: 'Hoàn thiện nhận diện và giới thiệu ngắn gọn về cộng đồng của bạn.' },
  { a: 'Ai được vào, và vào với', b: 'giá bao nhiêu?', lead: 'Thiết lập quyền tham gia, mức giá và một số câu hỏi để hiểu thành viên của bạn hơn.' },
  { a: 'Sẵn sàng', b: 'ra mắt!', lead: 'Kiểm tra lại thông tin trước khi mở cộng đồng.' },
];

const NEXT_STEP_INDEX: Record<DraftView['nextStep'], number> = { basics: 0, plan: 1, identity: 2, members: 3, launch: 4 };

const emptyCard = (): CardForm => ({ number: '', expiry: '', cvc: '' });

function toHostPlans(data: NonNullable<ReturnType<typeof useOwnerPlans>['data']>): { plans: HostPlanInfo[]; fees?: FeeInfo } {
  const annualPct = data.cycles.find((c) => c.key === 'annual')?.savingsPct;
  const plans: HostPlanInfo[] = data.plans.map((p) => ({
    id: p.key,
    name: p.name,
    tagline: p.tagline,
    free: p.key === 'start',
    popular: p.popular,
    currency: data.currency,
    monthlyPrice: p.priceMonthly,
    annualPrice: p.priceAnnual,
    annualSavingsPct: p.key === 'pro' ? annualPct : undefined,
    trialDays: p.key === 'pro' ? data.trialDays : 0,
    features: p.features,
    fit: p.fit,
  }));
  const start = data.plans.find((p) => p.key === 'start');
  const pro = data.plans.find((p) => p.key === 'pro');
  return { plans, fees: start && pro ? { freeFeeRate: start.transactionFeePct / 100, proFeeRate: pro.transactionFeePct / 100 } : undefined };
}

function formatDay(iso: Date): string {
  return `${String(iso.getDate()).padStart(2, '0')}/${iso.getMonth() + 1}`;
}

export function CreateWizard() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const draftParam = params.get('draft');

  const { data: categories = [] } = useCategories();
  const ownerPlans = useOwnerPlans();
  const rulesTemplate = useRulesTemplate();
  const draftQuery = useDraft(draftParam);

  const createDraft = useCreateDraft();
  const patchStep = usePatchDraftStep();
  const publish = usePublishDraft();
  const payoutApi = usePayoutAccount();

  const [form, setForm] = useState<WizardForm>(defaultForm);
  const [step, setStep] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftView | null>(null);
  const [card, setCard] = useState<CardForm>(emptyCard);
  const [cardErrors, setCardErrors] = useState<CardErrors>({});
  const [published, setPublished] = useState<PublishedCommunity | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [payoutError, setPayoutError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const draftInit = useRef(false);
  const rulesSeeded = useRef(false);

  const showToast = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(null), 2400);
  };

  // ---- Mở lại bản nháp (?draft=<id>) ----
  useEffect(() => {
    if (!draftParam || draftInit.current || !draftQuery.data) return;
    draftInit.current = true;
    const d = draftQuery.data;
    setDraft(d);
    setForm((f) => formFromDraft(d, f));
    const s = NEXT_STEP_INDEX[d.nextStep];
    setStep(s);
    setFurthest(s);
    if (d.members.rules.length) rulesSeeded.current = true;
  }, [draftParam, draftQuery.data]);

  // ---- Nội quy mẫu từ BE (chỉ khi bản nháp chưa có nội quy) ----
  useEffect(() => {
    if (rulesSeeded.current || !rulesTemplate.data) return;
    if (draftParam && !draftInit.current) return;
    rulesSeeded.current = true;
    setForm((f) => (f.rules.length ? f : { ...f, rules: rulesTemplate.data.map((r) => ({ title: r.title, body: r.body ?? '' })) }));
  }, [rulesTemplate.data, draftParam, draftQuery.data]);

  // ---- Kiểm tra slug (debounce 300ms) ----
  const debouncedSlug = useDebounced(form.slug, 300);
  const slugLocalOk = SLUG_RE.test(form.slug) && form.slug.length >= 3 && form.slug.length <= 40;
  const slugQuery = useQuery({
    queryKey: ['wizard', 'slug', debouncedSlug, draft?.id ?? ''],
    queryFn: ({ signal }) => api.checkSlug(debouncedSlug, signal),
    enabled: SLUG_RE.test(debouncedSlug) && debouncedSlug.length >= 3,
    staleTime: 15_000,
  });
  let slugStatus: SlugStatus = 'idle';
  let slugReason: string | undefined;
  if (form.slug) {
    if (!slugLocalOk) {
      slugStatus = 'invalid';
      slugReason = form.slug.length < 3 ? 'Đường dẫn tối thiểu 3 ký tự' : 'Chỉ dùng chữ thường, số và dấu gạch ngang';
    } else if (debouncedSlug !== form.slug || slugQuery.isFetching || !slugQuery.data) {
      slugStatus = slugQuery.isError && debouncedSlug === form.slug ? 'idle' : 'checking';
    } else if (slugQuery.data.available) slugStatus = 'available';
    else {
      slugStatus = slugQuery.data.reason === 'taken' ? 'taken' : 'invalid';
      slugReason = `${slugQuery.data.message}${slugQuery.data.suggestion ? ` Gợi ý: ${slugQuery.data.suggestion}` : ''}`;
    }
  }

  // ---- Gói hosting của chủ cộng đồng ----
  const hostData = useMemo(() => (ownerPlans.data ? toHostPlans(ownerPlans.data) : null), [ownerPlans.data]);
  const proPlan = hostData?.plans.find((p) => !p.free);
  const hostTrialDays = proPlan?.trialDays ?? 0;
  const savedTrialEnd = draft?.plan?.planKey === 'pro' ? draft.plan.trialEndsAt : null;
  const [mountedAt] = useState(() => Date.now());
  let hostTrialEnd: string | undefined;
  if (savedTrialEnd) hostTrialEnd = formatDay(new Date(savedTrialEnd));
  else if (hostTrialDays) hostTrialEnd = formatDay(new Date(mountedAt + hostTrialDays * 86_400_000)); // ước lượng trước khi lưu; ngày chính thức do BE chốt (trialEndsAt)
  const savedCardReady = !!draft?.plan && draft.plan.planKey === 'pro' && draft.plan.cycle === form.hostCycle && !!draft.plan.paymentMethod;
  const typedCardOk = Object.keys(validateCard(card)).length === 0;

  // ---- Giá thành viên: ước tính "Bạn nhận về" từ BE ----
  const priceForEstimate = parseMoney(form.billing === 'year' ? form.priceAnnual : form.priceMonthly);
  const debouncedPrice = useDebounced(Number.isFinite(priceForEstimate) ? priceForEstimate : 0, 400);
  const estimate = useRevenueEstimate(debouncedPrice, form.billing === 'year' ? 'annual' : 'monthly', step === 3 && form.billing !== 'free');
  const netUsd = estimate.data ? estimate.data.netPerMemberCents / 100 : undefined;
  const annualDiscountPct = useMemo(() => {
    const m = parseMoney(form.priceMonthly);
    const a = parseMoney(form.priceAnnual);
    return m > 0 && a > 0 && a < m * 12 ? Math.round((1 - a / (m * 12)) * 100) : undefined;
  }, [form.priceMonthly, form.priceAnnual]);

  const checklist = useLaunchChecklist(published?.id ?? '', !!published);

  const set = (patch: Partial<WizardForm>, clear?: string[]) => {
    setForm((f) => ({ ...f, ...patch }));
    setGeneral(null);
    if (clear?.length || Object.keys(errors).length) {
      setErrors((e) => {
        const n = { ...e };
        for (const k of clear ?? []) delete n[k];
        // Sửa câu hỏi/lợi ích: bỏ lỗi từng câu theo tiền tố
        if ('questions' in patch) for (const k of Object.keys(n)) if (k.startsWith('question-')) delete n[k];
        return n;
      });
    }
  };

  const onNameChange = (name: string) => {
    setForm((f) => ({ ...f, name, slug: f.slugTouched ? f.slug : slugify(name) }));
    setErrors((e) => ({ ...e, name: undefined, ...(form.slugTouched ? {} : { slug: undefined }) }));
    setGeneral(null);
  };
  const onSlugChange = (raw: string) => {
    const slug = raw.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-{2,}/g, '-').slice(0, 40);
    setForm((f) => ({ ...f, slug, slugTouched: true }));
    setErrors((e) => ({ ...e, slug: undefined }));
    setGeneral(null);
  };

  const ctx = () => ({
    slugAvailable: slugQuery.data && debouncedSlug === form.slug ? slugQuery.data.available : undefined,
    slugChecking: slugStatus === 'checking',
    hostCardReady: savedCardReady || typedCardOk,
  });

  const fail = (err: unknown) => {
    const { fields, general: g } = serverFieldErrors(err);
    setErrors((e) => ({ ...e, ...fields }));
    setGeneral(g ?? null);
    const target = Object.keys(fields).map((k) => FIELD_STEP[k] ?? (k.startsWith('question-') ? 3 : undefined)).find((s) => s !== undefined);
    if (target !== undefined && target !== step && target < 4) setStep(target);
    if (err instanceof ApiError && err.code === 'DRAFT_INCOMPLETE') {
      const m = (err.details?.missing as { step: string; field: string; message: string }[] | undefined) ?? [];
      if (m.length) setDraft((d) => (d ? { ...d, readiness: { canPublish: false, missing: m } } : d));
    }
  };

  /** Lưu bước hiện tại vào bản nháp ở BE. Trả true nếu thành công (hoặc không có gì để lưu). */
  const saveStep = async (s: number): Promise<boolean> => {
    setSaving(true);
    try {
      if (s === 0) {
        const body = basicsBody(form);
        const res = draft ? await patchStep.mutateAsync({ id: draft.id, step: 'basics', body }) : await createDraft.mutateAsync(body as api.BasicsBody);
        setDraft(res);
        // Server có thể chuẩn hóa slug — phản ánh lại.
        setForm((f) => ({ ...f, slug: res.slug }));
      } else if (!draft) {
        return false;
      } else if (s === 1) {
        if (form.hostPlan === 'start') {
          setDraft(await patchStep.mutateAsync({ id: draft.id, step: 'plan', body: { planKey: 'start' } }));
        } else if (typedCardOk) {
          const pm = toPaymentMethodInput(tokenizeCard(card));
          setDraft(await patchStep.mutateAsync({ id: draft.id, step: 'plan', body: { planKey: 'pro', cycle: form.hostCycle, paymentMethod: pm } }));
          setCard(emptyCard()); // bỏ số thẻ/CVC khỏi bộ nhớ ngay sau khi tokenise
        } // else: đã có thẻ lưu ở nháp cùng chu kỳ → không cần lưu lại
      } else if (s === 2) {
        setDraft(await patchStep.mutateAsync({ id: draft.id, step: 'identity', body: identityBody(form) }));
      } else if (s === 3) {
        setDraft(await patchStep.mutateAsync({ id: draft.id, step: 'members', body: membersBody(form) }));
      }
      return true;
    } catch (err) {
      fail(err);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const attemptCardErrors = (): boolean => {
    if (form.hostPlan !== 'pro' || savedCardReady) return true;
    const ce = validateCard(card);
    setCardErrors(ce);
    return Object.keys(ce).length === 0;
  };

  const next = async () => {
    setGeneral(null);
    if (step === 4) {
      const e = validateStep(4, form, ctx());
      setErrors(e);
      if (Object.keys(e).length || !draft) return;
      setSaving(true);
      try {
        const res = await publish.mutateAsync(draft.id);
        setPublished(res);
        setFurthest(4);
      } catch (err) {
        fail(err);
      } finally {
        setSaving(false);
      }
      return;
    }
    const e = validateStep(step, form, ctx());
    // Thẻ: lỗi chi tiết hiện ngay ở ô thẻ thay vì một dòng chung.
    if (step === 1) {
      delete e.hostCard;
      if (!attemptCardErrors()) {
        setErrors(e);
        return;
      }
    }
    setErrors(e);
    if (Object.keys(e).length) return;
    if (!(await saveStep(step))) return;
    setStep(step + 1);
    setFurthest((f) => Math.max(f, step + 1));
  };

  const goto = (i: number) => {
    if (published || i > furthest) return;
    setErrors({});
    setGeneral(null);
    setStep(i);
  };

  const back = () => {
    if (step === 0) {
      navigate('/');
      return;
    }
    setErrors({});
    setGeneral(null);
    setStep(step - 1);
  };

  const saveAndExit = async () => {
    setGeneral(null);
    const e = validateStep(step, form, ctx());
    if (step === 1) delete e.hostCard;
    if (step === 1 && form.hostPlan === 'pro' && !savedCardReady && !typedCardOk) {
      // Chưa nhập thẻ: lưu những gì có thể, bỏ qua gói Chuyên nghiệp.
      delete e.hostCard;
    }
    if (step === 4) delete e.terms;
    setErrors(e);
    if (Object.keys(e).length) return;
    if (step < 4 && !(step === 1 && form.hostPlan === 'pro' && !savedCardReady && !typedCardOk) && !(await saveStep(step))) return;
    showToast('Đã lưu nháp');
    navigate('/me/communities');
  };

  const connectPayout = async (v: PayoutValues) => {
    if (!draft) throw new Error('Hãy hoàn tất bước 1 trước');
    setPayoutError(undefined);
    await payoutApi.connect.mutateAsync({ id: draft.id, ...v });
    setDraft((d) => (d ? { ...d, payout: { status: 'connected', accountMasked: undefined, bankName: v.bankName } } : d));
    showToast('Đã kết nối tài khoản nhận tiền');
  };
  const skipPayout = async () => {
    if (!draft) return;
    setPayoutError(undefined);
    try {
      await payoutApi.skip.mutateAsync(draft.id);
      setDraft((d) => (d ? { ...d, payout: { status: 'skipped' } } : d));
    } catch (err) {
      setPayoutError(err instanceof Error ? err.message : 'Không thực hiện được, vui lòng thử lại');
    }
  };
  const payoutInfo: PayoutInfo = draft?.payout
    ? { status: draft.payout.status, label: [draft.payout.bankName, draft.payout.accountMasked].filter(Boolean).join(' ') || undefined }
    : { status: 'none' };

  const inviteUrl = published ? `${window.location.origin}/communities/${published.id}` : '';
  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      showToast('Đã sao chép link mời');
    } catch {
      showToast('Không sao chép được, hãy chép link thủ công');
    }
  };

  const initials = (form.name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2) || 'SH').toUpperCase();
  const priceLabel =
    furthest < 3 && step < 3
      ? 'Giá đặt ở bước 4'
      : form.billing === 'free'
        ? 'Miễn phí'
        : form.billing === 'month'
          ? `${formatMoney(parseMoney(form.priceMonthly) || 0)}/tháng`
          : `${formatMoney(parseMoney(form.priceAnnual) || 0)}/năm`;

  const trialDaysMember = draft?.members.trialDays ?? 0;
  const summary: SummaryRow[] = [
    { label: 'Tên cộng đồng', value: form.name, step: 0 },
    { label: 'Đường dẫn', value: `sofinhub.com/${form.slug}`, step: 0 },
    { label: 'Danh mục', value: categories.find((c) => c.id === form.category)?.name ?? form.category, step: 0 },
    {
      label: 'Gói',
      value:
        form.hostPlan === 'pro' && proPlan
          ? `${proPlan.name} · ${form.hostCycle === 'annual' ? 'theo năm' : 'theo tháng'}${hostTrialDays ? ` · dùng thử ${hostTrialDays} ngày` : ''}`
          : `${hostData?.plans.find((p) => p.free)?.name ?? 'Khởi đầu'} · miễn phí`,
      step: 1,
    },
    { label: 'Lời hứa', value: form.promise || 'Chưa có', step: 2 },
    { label: 'Lợi ích', value: `${form.benefits.filter((b) => b.trim()).length} điều thành viên nhận được`, step: 2 },
    { label: 'Quyền truy cập', value: `${form.visibility === 'public' ? 'Công khai' : 'Riêng tư'} · ${form.questions.filter((q) => q.trim()).length} câu hỏi gia nhập`, step: 3 },
    {
      label: 'Giá',
      value:
        form.billing === 'free'
          ? 'Miễn phí'
          : `${formatMoney(parseMoney(form.priceMonthly) || 0)}/tháng${form.billing === 'year' ? ` · ${formatMoney(parseMoney(form.priceAnnual) || 0)}/năm` : ''}${form.trialEnabled && trialDaysMember ? ` · dùng thử ${trialDaysMember} ngày` : ''}`,
      step: 3,
    },
  ];

  // ---- Giao diện ----
  if (draftParam && draftQuery.isPending) return <p className="py-24 text-center text-stone-500">Đang tải bản nháp…</p>;
  if (draftParam && (draftQuery.isError || !draftQuery.data)) {
    return (
      <div className="mx-auto max-w-[520px] px-4 py-24 text-center">
        <p className="text-xl font-bold">Không tìm thấy bản nháp</p>
        <p className="mt-2 text-stone-600">Bản nháp có thể đã được ra mắt hoặc đã bị xóa.</p>
        <Link to="/communities/new" className="mt-4 inline-block font-semibold text-brand hover:underline">Tạo cộng đồng mới</Link>
      </div>
    );
  }

  const head = HEAD[step] ?? HEAD[0]!;
  const busy = saving || createDraft.isPending || patchStep.isPending || publish.isPending;
  const tip =
    published
      ? null
      : step === 3
        ? { t: 'Mẹo đặt giá', s: 'Hãy cân nhắc giá trị bạn mang lại cho thành viên để chọn mức giá phù hợp.' }
        : step === 1
          ? { t: 'Đổi gói bất cứ lúc nào', s: 'Nâng hoặc hạ gói trong Cài đặt cộng đồng, áp dụng từ kỳ thanh toán kế tiếp.' }
          : step === 2
            ? { t: 'Trang giới thiệu = trang bán hàng', s: 'Logo, ảnh bìa, mô tả và các lợi ích nổi bật sẽ hiển thị trên trang cộng đồng của bạn.' }
            : step === 4
              ? { t: 'Sắp xong rồi', s: 'Mọi thứ ở đây đều sửa được sau trong Cài đặt cộng đồng.' }
              : { t: 'Khoảng 10 phút', s: 'Mọi thứ ở đây đều sửa được sau trong Cài đặt cộng đồng.' };

  return (
    <div className="mx-auto grid w-full max-w-[1320px] gap-4 px-4 pt-6 pb-10 md:px-10 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="flex flex-col gap-1.5 rounded-[20px] border border-[rgba(120,60,20,.07)] bg-white p-3.5 lg:self-start">
        <div className="flex items-center gap-3.5 px-2 pt-1 pb-3.5">
          <span className="text-xl font-extrabold tracking-[-0.02em]">Tạo cộng đồng</span>
          <MaterialIcon name="auto_awesome" size={20} color="#fbbf24" filled />
        </div>
        <ol aria-label="Các bước" className="m-0 flex list-none flex-col gap-1.5 p-0 max-lg:flex-row max-lg:overflow-x-auto">
          {STEP_LABELS.map((label, i) => {
            const on = i === (published ? 4 : step);
            const done = published ? true : i < step;
            const clickable = !published && i <= furthest;
            return (
              <li key={label}>
                <button
                  type="button"
                  aria-current={on ? 'step' : undefined}
                  disabled={!clickable}
                  onClick={() => goto(i)}
                  className={`flex w-full items-center gap-3.5 rounded-[14px] border-0 px-3 py-2.5 text-left max-lg:whitespace-nowrap ${on ? 'bg-[#fff1e6]' : 'bg-transparent'} ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <span className={`grid size-[38px] flex-none place-items-center rounded-full text-[15px] font-bold ${on || done ? 'bg-brand-gradient border-0 text-white' : 'border-[1.5px] border-[#e7e0da] bg-white text-stone-700'} ${on ? 'shadow-[0_6px_14px_rgba(242,106,27,.3)]' : ''}`}>
                    {done ? '✓' : i + 1}
                  </span>
                  <span className={`text-[15px] ${on ? 'font-bold text-stone-900' : 'font-medium text-stone-600'}`}>{label}</span>
                </button>
              </li>
            );
          })}
        </ol>
        {tip && (
          <div className="mt-2 flex gap-3 rounded-[14px] bg-[#faf7f4] p-3.5 max-lg:hidden">
            <MaterialIcon name="lightbulb" size={26} color="#f59e0b" filled />
            <div>
              <div className="text-sm font-bold">{tip.t}</div>
              <div className="mt-0.5 text-[12.5px] leading-normal text-stone-500">{tip.s}</div>
            </div>
          </div>
        )}
        {!published && (
          <button type="button" onClick={() => void saveAndExit()} disabled={busy} className="flex items-center gap-1.5 border-0 bg-transparent px-2.5 pt-3 pb-0.5 text-left text-sm font-semibold underline disabled:opacity-60">
            Lưu nháp &amp; thoát
            <MaterialIcon name="arrow_forward" size={18} />
          </button>
        )}
      </aside>

      <div className="flex min-w-0 flex-col gap-4">
        <main className="min-w-0 rounded-[20px] border border-[rgba(120,60,20,.07)] bg-white/90 p-5 md:px-[30px] md:pt-[22px] md:pb-[30px]">
          {published ? (
            <LaunchView
              name={form.name}
              communityId={published.id}
              inviteUrl={inviteUrl}
              checklist={checklist.data}
              loading={checklist.isPending}
              error={checklist.isError ? 'Không tải được danh sách ra mắt' : undefined}
              onCopy={() => void copyInvite()}
            />
          ) : (
            <>
              <div className="flex items-center gap-3.5 text-[13px] text-stone-500">
                <span className="flex-none">Bước {step + 1} / 5</span>
                <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-[#efeae6]">
                  <div className="h-full rounded-full bg-[linear-gradient(90deg,#ff8f45,#f26a1b)] transition-[width]" style={{ width: `${(step + 1) * 20}%` }} />
                </div>
              </div>
              <h1 className="mt-5 mb-0 text-[clamp(26px,3vw,40px)] leading-[1.15] font-extrabold tracking-[-0.03em]">
                {head.a} <span className="text-brand">{head.b.replace('{n}', String(hostTrialDays || ''))}</span>
                {head.c}
              </h1>
              <p className="mt-2 mb-0 text-[15.5px] leading-relaxed text-stone-600">{head.lead}</p>

              <div className={`mt-5 grid items-start gap-[22px] ${step === 0 || step === 2 ? 'xl:grid-cols-[minmax(0,1fr)_minmax(280px,370px)]' : ''}`}>
                <div className="min-w-0">
                  {step === 0 && (
                    <StepBasics form={form} set={set} errors={errors} categories={categories} slugStatus={slugStatus} slugReason={slugReason} onSlugChange={onSlugChange} onNameChange={onNameChange} />
                  )}
                  {step === 1 && (
                    <StepHostPlan
                      form={form}
                      set={set}
                      errors={errors}
                      plans={hostData?.plans ?? []}
                      plansLoading={ownerPlans.isPending}
                      plansError={ownerPlans.isError ? 'Không tải được danh sách gói, vui lòng thử lại' : undefined}
                      fees={hostData?.fees}
                      trialEndLabel={hostTrialEnd}
                      cardSlot={
                        savedCardReady && draft?.plan?.paymentMethod ? (
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span className="flex items-center gap-2 font-semibold">
                              <MaterialIcon name="credit_card" size={22} color="#f26a1b" filled />
                              Thẻ {draft.plan.paymentMethod.brand} •••• {draft.plan.paymentMethod.last4} đã được lưu
                            </span>
                            <button
                              type="button"
                              onClick={() => setDraft((d) => (d && d.plan ? { ...d, plan: { ...d.plan, paymentMethod: null } } : d))}
                              className="border-0 bg-transparent font-semibold text-brand underline"
                            >
                              Dùng thẻ khác
                            </button>
                          </div>
                        ) : (
                          <CardFields variant="stacked" value={card} onChange={(v) => { setCard(v); setCardErrors({}); setErrors((e) => ({ ...e, hostCard: undefined })); }} errors={cardErrors} />
                        )
                      }
                    />
                  )}
                  {step === 2 && <StepBrand form={form} set={set} errors={errors} />}
                  {step === 3 && (
                    <StepMembers
                      form={form}
                      set={set}
                      errors={errors}
                      currency="USD"
                      annualDiscountPct={annualDiscountPct}
                      net={netUsd !== undefined ? { monthly: netUsd, annual: netUsd } : undefined}
                      feeNote={estimate.data ? `Hoa hồng nền tảng ${estimate.data.commissionPct}% + phí cổng thanh toán ${estimate.data.gatewayFeePct}%` : undefined}
                      trialDays={draft?.members.trialDays}
                      maxQuestions={MAX_QUESTIONS}
                      payout={payoutInfo}
                      onConnectPayout={connectPayout}
                      onSkipPayout={() => void skipPayout()}
                      payoutBusy={payoutApi.connect.isPending || payoutApi.skip.isPending}
                      payoutError={payoutError}
                    />
                  )}
                  {step === 4 && (
                    <StepSummary
                      rows={summary}
                      onEdit={goto}
                      terms={form.terms}
                      onTerms={(terms) => set({ terms }, ['terms'])}
                      termsError={errors.terms}
                      missing={draft && !draft.readiness.canPublish ? draft.readiness.missing : []}
                    />
                  )}
                </div>
                {step === 0 && <DiscoverPreview form={form} initials={initials} priceLabel={priceLabel} />}
                {step === 2 && <AboutPreview form={form} initials={initials} />}
              </div>
            </>
          )}
        </main>

        {!published && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[rgba(120,60,20,.07)] bg-white px-5 py-3">
            <button type="button" onClick={back} disabled={busy} className="flex h-12 items-center gap-2 rounded-xl border-[1.5px] border-[#e7e0da] bg-white px-7 text-[15px] font-bold disabled:opacity-60">
              {step > 0 && <MaterialIcon name="arrow_back" size={19} />}
              {step === 0 ? 'Hủy' : 'Quay lại'}
            </button>
            {(general || Object.keys(errors).some((k) => errors[k])) && (
              <span role="alert" className="min-w-0 flex-1 text-[13.5px] font-semibold text-red-700">
                {general ?? 'Vui lòng kiểm tra các ô được đánh dấu đỏ.'}
              </span>
            )}
            {step === 2 && (
              <button type="button" onClick={() => { setErrors({}); setStep(3); setFurthest((f) => Math.max(f, 3)); }} className="ml-auto h-12 rounded-xl border-[1.5px] border-[#e7e0da] bg-white px-6 text-[15px] font-bold">
                Bỏ qua, làm sau
              </button>
            )}
            <Button onClick={() => void next()} disabled={busy} className="h-12 gap-2 rounded-xl px-9 text-base font-bold">
              {busy ? 'Đang lưu…' : step === 4 ? 'Ra mắt cộng đồng' : step === 3 ? 'Tạo cộng đồng' : step === 1 && form.hostPlan === 'pro' ? 'Bắt đầu dùng thử' : 'Tiếp tục'}
              {!busy && <MaterialIcon name="arrow_forward" size={20} color="#fff" />}
            </Button>
          </div>
        )}
      </div>

      {toast && (
        <div role="status" className="fixed right-6 bottom-6 z-50 rounded-[14px] bg-stone-900 px-[18px] py-[13px] text-sm font-medium text-white shadow-[0_16px_40px_rgba(28,25,23,.3)]">
          {toast}
        </div>
      )}
    </div>
  );
}

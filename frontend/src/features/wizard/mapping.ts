import i18n from '../../i18n';
import { ApiError } from '../../lib/api';
import type { IdentityBody, MembersBody, BasicsBody } from './api';
import { defaultForm, parseMoney, type FieldErrors, type WizardForm } from './form';
import type { DraftView } from './types';

/** Điền form từ bản nháp đã lưu ở BE (mở lại nháp). */
export function formFromDraft(d: DraftView, base: WizardForm = defaultForm()): WizardForm {
  const m = d.members;
  const annual = m.priceAnnualUsd && m.priceAnnualUsd > 0;
  return {
    ...base,
    name: d.basics.title,
    slug: d.basics.slug,
    slugTouched: true,
    description: d.basics.description,
    category: d.basics.category,
    hostPlan: d.plan?.planKey ?? 'start',
    hostCycle: d.plan?.cycle ?? 'monthly',
    logoUrl: d.identity.logoUrl ?? '',
    coverUrl: d.identity.coverUrl ?? '',
    brandColor: d.identity.brandColor ?? base.brandColor,
    promise: d.identity.promise ?? '',
    benefits: d.identity.benefits.length ? [...d.identity.benefits] : ['', '', ''],
    videoUrl: d.identity.introVideoUrl ?? '',
    visibility: m.visibility,
    billing: m.priceUsd > 0 ? (annual ? 'year' : 'month') : 'free',
    priceMonthly: m.priceUsd > 0 ? String(m.priceUsd) : '',
    priceAnnual: annual ? String(m.priceAnnualUsd) : '',
    trialEnabled: m.memberTrialEnabled,
    questions: [...m.joinQuestions],
    rules: m.rules.map((r) => ({ title: r.title, body: r.body ?? '' })),
    rulesRequireAgreement: m.requireRulesAgreement,
    rulesAutoApprovePaid: m.autoApprovePaid,
  };
}

/** Chuyển lỗi chung của form thành bước (0-3) mà trường lỗi thuộc về. */
export const FIELD_STEP: Record<string, number> = {
  name: 0,
  slug: 0,
  description: 0,
  category: 0,
  hostCard: 1,
  logoUrl: 2,
  coverUrl: 2,
  promise: 2,
  benefits: 2,
  videoUrl: 2,
  priceMonthly: 3,
  priceAnnual: 3,
  questions: 3,
  rules: 3,
};

export const basicsBody = (f: WizardForm): BasicsBody => ({
  title: f.name.trim(),
  description: f.description.trim(),
  category: f.category,
  ...(f.slug ? { slug: f.slug } : {}),
});

export const identityBody = (f: WizardForm): IdentityBody => ({
  logoUrl: f.logoUrl || null,
  coverUrl: f.coverUrl || null,
  brandColor: f.brandColor || null,
  promise: f.promise.trim() || null,
  benefits: f.benefits.map((b) => b.trim()).filter(Boolean),
  introVideoUrl: f.videoUrl.trim() || null,
});

export const membersBody = (f: WizardForm): MembersBody => {
  const paid = f.billing !== 'free';
  return {
    visibility: f.visibility,
    priceUsd: paid ? parseMoney(f.priceMonthly) : 0,
    priceAnnualUsd: paid && f.billing === 'year' ? parseMoney(f.priceAnnual) : null,
    memberTrialEnabled: paid ? f.trialEnabled : false,
    joinQuestions: f.questions.map((q) => q.trim()).filter(Boolean),
    rules: f.rules
      .map((r) => ({ title: r.title.trim().slice(0, 80), body: r.body.trim().slice(0, 500) }))
      .filter((r) => r.title)
      .map((r) => (r.body ? r : { title: r.title })),
    requireRulesAgreement: f.rulesRequireAgreement,
    autoApprovePaid: f.rulesAutoApprovePaid,
  };
};

// Tên trường của BE → tên trường của form.
const SERVER_FIELD: Record<string, string> = {
  title: 'name',
  slug: 'slug',
  description: 'description',
  category: 'category',
  logoUrl: 'logoUrl',
  coverUrl: 'coverUrl',
  promise: 'promise',
  benefits: 'benefits',
  introVideoUrl: 'videoUrl',
  priceUsd: 'priceMonthly',
  priceAnnualUsd: 'priceAnnual',
  paymentMethod: 'hostCard',
  joinQuestions: 'questions',
  rules: 'rules',
};

/** Đọc `error.details.fieldErrors` của BE ra lỗi theo từng ô; lỗi không gắn được vào ô nào thì trả `general`. */
export function serverFieldErrors(err: unknown): { fields: FieldErrors; general?: string } {
  if (!(err instanceof ApiError)) return { fields: {}, general: err instanceof Error ? err.message : i18n.t('errors.generic', { ns: 'wizard' }) };
  const fields: FieldErrors = {};
  const raw = err.details?.fieldErrors;
  if (raw) {
    for (const [k, msgs] of Object.entries(raw)) {
      const [root = k, idx] = k.split('.');
      const target = SERVER_FIELD[root] ?? SERVER_FIELD[k];
      const msg = msgs?.[0];
      if (!target || !msg) continue;
      if (target === 'questions' && idx !== undefined && /^\d+$/.test(idx)) fields[`question-${idx}`] = msg;
      else fields[target] = msg;
    }
  }
  if (err.code === 'SLUG_TAKEN') fields.slug = i18n.t('validation.slugTaken', { ns: 'wizard' });
  else if (err.code === 'SLUG_INVALID' || err.code === 'SLUG_RESERVED') fields.slug = err.message;
  if (Object.keys(fields).length) return { fields };
  return { fields, general: err.message };
}

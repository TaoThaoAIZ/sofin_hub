import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Field } from '../account/components/Field';
import { validateEmail, validateRequired } from '../auth/validation';
import { Button } from '../../components/ui/Button';
import { ApiError } from '../../lib/api';
import { sendToolLead } from '../support/api';
import type { DownloadTool } from './catalog';

const PHONE_RE = /^(\+?84|0)\d{9}$/;

/** Popup để lại thông tin mua tool — gửi qua endpoint /contact (vào hộp thư hỗ trợ của admin). */
export function ToolLeadForm({ tool, onClose }: { tool: DownloadTool; onClose: () => void }) {
  const { t } = useTranslation('tools');
  const [form, setForm] = useState({ name: '', phone: '', email: '' });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const set = (k: keyof typeof form) => (v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const phone = form.phone.replace(/[\s.-]/g, '');
    const errs = {
      name: validateRequired(form.name, t('form.name').toLowerCase()) ?? undefined,
      phone: PHONE_RE.test(phone) ? undefined : t('form.phoneInvalid'),
      email: form.email.trim() ? (validateEmail(form.email) ?? undefined) : undefined,
    };
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    setSubmitting(true);
    setError(null);
    try {
      await sendToolLead({
        name: form.name.trim(),
        phone,
        toolId: tool.id,
        toolName: tool.name,
        ...(form.email.trim() && { email: form.email.trim() }),
      });
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) setError(t('form.rateLimit'));
      else setError(err instanceof ApiError ? err.message : t('form.failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-900/50 px-4 py-8"
    >
      <div
        className="relative flex w-full max-w-md flex-col gap-4 rounded-3xl bg-white p-6 shadow-[0_24px_60px_rgba(120,60,20,.25)]"
      >
        <button type="button" onClick={onClose} aria-label={t('form.close')} className="absolute top-4 right-5 text-2xl leading-none text-stone-400 hover:text-stone-700">
          ×
        </button>
        <div>
          <h3 className="m-0 pr-6 text-xl font-bold">{t('form.title', { tool: tool.name })}</h3>
          <p className="mt-1 mb-0 text-sm text-stone-600">{t('form.intro')}</p>
        </div>

        {done ? (
          <div className="flex flex-col gap-3">
            <Alert kind="success">
              <b>{t('form.successTitle')}</b>
              <br />
              {t('form.successBody')}
            </Alert>
            <Button onClick={onClose} className="h-11 rounded-2xl text-[15px] font-bold">
              {t('form.close')}
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="flex flex-col gap-3.5">
            <Field required label={t('form.name')} value={form.name} onChange={set('name')} error={errors.name} autoComplete="name" maxLength={100} />
            <Field required label={t('form.phone')} value={form.phone} onChange={set('phone')} error={errors.phone} autoComplete="tel" maxLength={20} />
            <Field label={t('form.email')} type="email" value={form.email} onChange={set('email')} error={errors.email} autoComplete="email" />
            {error && <Alert kind="error">{error}</Alert>}
            <Button type="submit" disabled={submitting} className="h-12 rounded-2xl text-[15px] font-bold">
              {submitting ? t('form.sending') : t('form.submit')}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

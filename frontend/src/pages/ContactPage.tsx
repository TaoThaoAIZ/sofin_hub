import { useState, type FormEvent } from 'react';
import { Footer } from '../components/layout/Footer';
import { Header } from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { ApiError } from '../lib/api';
import { validateEmail, validateRequired } from '../features/auth/validation';
import { Alert, Field } from '../features/account/components/Field';
import { sendContact } from '../features/support/api';

export function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (k: keyof typeof form) => (v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = {
      name: validateRequired(form.name, 'họ tên') ?? undefined,
      email: validateEmail(form.email) ?? undefined,
      subject: validateRequired(form.subject, 'tiêu đề') ?? undefined,
      message: validateRequired(form.message, 'nội dung') ?? undefined,
    };
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await sendContact({ name: form.name.trim(), email: form.email.trim(), subject: form.subject.trim(), message: form.message.trim() });
      setSuccess(res.message);
      setForm({ name: '', email: '', subject: '', message: '' });
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) setError('Bạn đã gửi quá nhiều yêu cầu, vui lòng thử lại sau ít phút.');
      else setError(err instanceof ApiError ? err.message : 'Không gửi được liên hệ, vui lòng thử lại');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="mx-auto w-full max-w-[680px] px-4 py-8 md:py-12">
        <h1 className="m-0 text-[clamp(26px,3vw,36px)] font-extrabold tracking-[-1px]">Liên hệ với chúng tôi</h1>
        <p className="mt-2 mb-6 text-stone-600">Gửi câu hỏi hoặc góp ý, đội ngũ SofinHub sẽ phản hồi qua email.</p>
        <form onSubmit={submit} noValidate className="glass flex flex-col gap-4 rounded-3xl p-5 sm:p-8">
          {success && <Alert kind="success">{success}</Alert>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Họ tên" value={form.name} onChange={set('name')} error={errors.name} autoComplete="name" maxLength={100} />
            <Field label="Email" type="email" value={form.email} onChange={set('email')} error={errors.email} autoComplete="email" />
          </div>
          <Field label="Tiêu đề" value={form.subject} onChange={set('subject')} error={errors.subject} maxLength={200} />
          <Field label="Nội dung" multiline rows={6} maxLength={5000} value={form.message} onChange={set('message')} error={errors.message} hint={`${form.message.length}/5000 ký tự`} />
          {error && <Alert kind="error">{error}</Alert>}
          <Button type="submit" disabled={submitting} className="h-12 self-start rounded-2xl px-6 text-[15px] font-bold">
            {submitting ? 'Đang gửi…' : 'Gửi liên hệ'}
          </Button>
        </form>
      </main>
      <Footer />
    </div>
  );
}

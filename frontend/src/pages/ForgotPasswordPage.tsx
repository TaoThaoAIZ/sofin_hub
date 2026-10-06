import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/FormField';
import { ApiError } from '../lib/api';
import { forgotPassword } from '../features/auth/api';
import { validateEmail } from '../features/auth/validation';
import { AuthShell } from '../features/account/components/AuthShell';
import { Alert } from '../features/account/components/Field';

export function ForgotPasswordPage() {
  const { t } = useTranslation('auth');
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const invalid = validateEmail(email);
    setFieldError(invalid ?? undefined);
    if (invalid) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await forgotPassword(email.trim());
      setSentMessage(res.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('forgot.fail'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell title={t('forgot.title')} subtitle={t('forgot.subtitle')}>
      {sentMessage ? (
        <div className="flex flex-col gap-4">
          <Alert kind="success">{sentMessage}</Alert>
          <p className="m-0 text-center text-sm text-stone-600">{t('forgot.checkInbox')}</p>
          <Link to="/login" className="text-center font-bold">
            {t('common.backToLogin')}
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <FormField
            type="email"
            autoComplete="email"
            value={email}
            onChange={(v) => {
              setEmail(v);
              setFieldError(undefined);
            }}
            placeholder={t('forgot.emailPlaceholder')}
            error={fieldError}
          />
          {error && <Alert kind="error">{error}</Alert>}
          <Button type="submit" disabled={submitting} className="h-[56px] rounded-2xl text-base font-bold">
            {submitting ? t('forgot.sending') : t('forgot.send')}
          </Button>
          <Link to="/login" className="text-center text-[15px] font-medium">
            {t('common.backToLogin')}
          </Link>
        </form>
      )}
    </AuthShell>
  );
}

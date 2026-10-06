import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, ButtonLink } from '../components/ui/Button';
import { FormField } from '../components/ui/FormField';
import { ApiError } from '../lib/api';
import { resetPassword } from '../features/auth/api';
import { validateNewPassword } from '../features/auth/validation';
import { AuthShell } from '../features/account/components/AuthShell';
import { Alert } from '../features/account/components/Field';

export function ResetPasswordPage() {
  const { t } = useTranslation('auth');
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [tokenInvalid, setTokenInvalid] = useState(false);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next = {
      password: validateNewPassword(password) ?? undefined,
      confirm: confirm !== password ? t('reset.mismatch') : undefined,
    };
    setErrors(next);
    if (next.password || next.confirm) return;
    setSubmitting(true);
    setError(null);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        // BE dùng chung 400 cho token sai/hết hạn/đã dùng và mật khẩu yếu; mật khẩu đã được kiểm tra ở FE nên coi là lỗi token.
        setTokenInvalid(true);
        setError(err.message);
      } else {
        setError(err instanceof ApiError ? err.message : t('reset.fail'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!token || tokenInvalid) {
    return (
      <AuthShell title={t('reset.invalidTitle')} subtitle={t('reset.invalidSubtitle')}>
        {error && <Alert kind="error">{error}</Alert>}
        <ButtonLink to="/forgot-password" className="h-[52px] rounded-2xl text-base font-bold">
          {t('reset.requestNew')}
        </ButtonLink>
        <Link to="/login" className="text-center text-[15px] font-medium">
          {t('common.backToLogin')}
        </Link>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell title={t('reset.doneTitle')} subtitle={t('reset.doneSubtitle')}>
        <ButtonLink to="/login" className="h-[52px] rounded-2xl text-base font-bold">
          {t('reset.signIn')}
        </ButtonLink>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t('reset.title')} subtitle={t('reset.subtitle')}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <FormField
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(v) => {
            setPassword(v);
            setErrors((x) => ({ ...x, password: undefined }));
          }}
          placeholder={t('reset.newPassword')}
          error={errors.password}
        />
        <FormField
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(v) => {
            setConfirm(v);
            setErrors((x) => ({ ...x, confirm: undefined }));
          }}
          placeholder={t('reset.repeatPassword')}
          error={errors.confirm}
        />
        {error && <Alert kind="error">{error}</Alert>}
        <Button type="submit" disabled={submitting} className="h-[56px] rounded-2xl text-base font-bold">
          {submitting ? t('reset.saving') : t('reset.submit')}
        </Button>
      </form>
    </AuthShell>
  );
}

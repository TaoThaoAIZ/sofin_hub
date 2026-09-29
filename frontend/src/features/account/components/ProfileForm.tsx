import { useState, type FormEvent } from 'react';
import { Button } from '../../../components/ui/Button';
import { ApiError } from '../../../lib/api';
import { useAuth } from '../../auth/AuthContext';
import { validateRequired } from '../../auth/validation';
import { useUpdateProfile } from '../queries';
import { Avatar } from './Avatar';
import { Alert, Field } from './Field';

const isHttp = (v: string) => /^https?:\/\/\S+$/i.test(v);

export function ProfileForm() {
  const { user } = useAuth();
  const update = useUpdateProfile();
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [location, setLocation] = useState(user?.location ?? '');
  const [website, setWebsite] = useState(user?.website ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? '');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const touch = () => setSaved(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const w = website.trim();
    const a = avatarUrl.trim();
    const next = {
      firstName: validateRequired(firstName, 'họ') ?? undefined,
      lastName: validateRequired(lastName, 'tên') ?? undefined,
      website: w && !isHttp(w) ? 'Website phải bắt đầu bằng http:// hoặc https://' : undefined,
      avatarUrl: a && !isHttp(a) && !a.startsWith('/files/') ? 'Ảnh đại diện phải là liên kết http(s)' : undefined,
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    setError(null);
    try {
      await update.mutateAsync({ firstName: firstName.trim(), lastName: lastName.trim(), bio: bio.trim(), location: location.trim(), website: w, avatarUrl: a });
      setSaved(true);
    } catch (err) {
      setSaved(false);
      setError(err instanceof ApiError ? err.message : 'Không lưu được hồ sơ, vui lòng thử lại');
    }
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <Avatar url={avatarUrl.trim() || null} name={`${firstName} ${lastName}`} size={64} />
        <div className="min-w-0 text-sm text-stone-600">
          <div className="truncate font-semibold text-stone-900">{user?.email}</div>
          <div>Email không thể thay đổi.</div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Họ" value={firstName} onChange={(v) => { setFirstName(v); touch(); }} error={errors.firstName} autoComplete="given-name" />
        <Field label="Tên" value={lastName} onChange={(v) => { setLastName(v); touch(); }} error={errors.lastName} autoComplete="family-name" />
      </div>
      <Field label="Giới thiệu" value={bio} onChange={(v) => { setBio(v); touch(); }} multiline maxLength={500} hint={`${bio.length}/500 ký tự`} />
      <Field label="Vị trí" value={location} onChange={(v) => { setLocation(v); touch(); }} maxLength={100} />
      <Field label="Website" type="url" value={website} onChange={(v) => { setWebsite(v); touch(); }} error={errors.website} hint="Ví dụ: https://example.com" />
      <Field
        label="Ảnh đại diện (URL)"
        type="url"
        value={avatarUrl}
        onChange={(v) => { setAvatarUrl(v); touch(); }}
        error={errors.avatarUrl}
        hint="Dán liên kết ảnh; để trống để dùng chữ cái đầu tên."
      />
      {error && <Alert kind="error">{error}</Alert>}
      {saved && <Alert kind="success">Đã lưu hồ sơ.</Alert>}
      <Button type="submit" disabled={update.isPending} className="h-12 self-start rounded-2xl px-6 text-[15px] font-bold">
        {update.isPending ? 'Đang lưu…' : 'Lưu thay đổi'}
      </Button>
    </form>
  );
}

import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { ApiError, resolveApiPath } from '../../../lib/api';
import { useUpdateProfile, usePublicProfile } from '../../account/queries';
import { useAuth } from '../../auth/AuthContext';
import { useUpload } from '../../uploads/useUpload';
import { useToast } from '../../admin/components/overlay';
import { BARE_INPUT, IconInput, OUTLINE_BTN, PRIMARY_BTN, Toggle } from '../ui';
import {
  BIO_MAX,
  diffToPatch,
  formFromUser,
  handleFormatError,
  initialsOf,
  sanitizeHandle,
  validateForm,
  type ProfileForm,
} from '../profile/form';
import { ProfilePreview } from '../profile/ProfilePreview';
import { useDebounced, useHandleAvailability } from '../profile/queries';

const SECTION = 'rounded-[20px] border border-[rgba(120,60,20,.07)] bg-white px-7 pt-6 pb-[26px]';
const LABEL = 'flex flex-col gap-2 text-[14.5px] font-bold';

/** Tab "Hồ sơ" (thiết kế "Cai dat ho so"): form bên trái, thẻ xem trước bên phải (≥1240px; hẹp hơn thì nằm dưới form). */
export function ProfileTab() {
  const { t } = useTranslation('settings');
  const { user } = useAuth();
  const toast = useToast();
  const update = useUpdateProfile();
  const { upload, uploading } = useUpload();
  const stats = usePublicProfile(user?.id ?? '');
  const fileRef = useRef<HTMLInputElement>(null);

  // `saved` = bản đang lưu ở server; `form` = bản đang sửa. Đổi tài khoản/lưu xong thì form đồng bộ lại theo saved.
  const saved = useMemo(() => (user ? formFromUser(user) : null), [user]);
  const [form, setForm] = useState<ProfileForm | null>(saved);
  const [dragOver, setDragOver] = useState(false);
  useEffect(() => {
    if (saved) setForm((f) => f ?? saved);
  }, [saved]);

  const handle = form?.handle ?? '';
  const fmtErr = handleFormatError(handle);
  const changed = !!saved && handle !== saved.handle && handle !== '';
  const debounced = useDebounced(handle);
  const checking = useHandleAvailability(debounced, changed && !fmtErr && debounced === handle);

  if (!user || !saved || !form) return <main className="min-w-0" />;

  const set = <K extends keyof ProfileForm>(k: K, v: ProfileForm[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  // Trạng thái ô đường dẫn: [ok?, text, đang kiểm tra?]
  let hOk = true;
  let hText = '';
  let hPending = false;
  if (fmtErr) [hOk, hText] = [false, fmtErr];
  else if (changed) {
    if (debounced !== handle || checking.isFetching) hPending = true;
    else if (checking.data && !checking.data.available) [hOk, hText] = [false, checking.data.reason === 'reserved' ? t('profileTab.handleReserved') : checking.data.reason === 'invalid' ? t('profileTab.handleInvalid') : t('profileTab.handleTaken')];
    else if (!checking.data) hPending = true;
  }

  // Ảnh đại diện lưu ngay (không cần bấm "Lưu thay đổi"); các trường khác đang sửa dở được giữ nguyên.
  const saveAvatar = async (avatarUrl: string) => {
    const next = await update.mutateAsync({ avatarUrl });
    set('avatarUrl', next.avatarUrl ?? '');
    toast.success(avatarUrl ? t('profileTab.avatarUpdated') : t('profileTab.avatarRemoved'));
  };
  const pickAvatar = async (file: File | undefined) => {
    if (!file) return;
    try {
      const up = await upload(file, { purpose: 'avatar' });
      await saveAvatar(up.url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('profileTab.uploadFail'));
    }
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    void pickAvatar(e.dataTransfer.files[0]);
  };

  const cancel = () => {
    setForm(saved);
    toast.success(dirty ? t('profileTab.cancelled') : t('profileTab.noChanges'));
  };

  const save = async () => {
    if (!dirty) return toast.success(t('profileTab.noChanges'));
    const invalid = validateForm(form);
    if (invalid) return toast.error(invalid);
    if (!hOk) return toast.error(t('profileTab.handleBad'));
    if (hPending) return toast.error(t('profileTab.handleChecking'));
    try {
      const next = await update.mutateAsync(diffToPatch(saved, form));
      setForm(formFromUser(next));
      toast.success(t('profileTab.saved'));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t('profileTab.saveFail'));
    }
  };

  const links = [
    { key: 'website', label: 'Website', icon: 'language', color: '#57534e', ph: 'https://' },
    { key: 'instagram', label: 'Instagram', icon: 'photo_camera', color: '#e1306c', ph: t('profileTab.instagramPh') },
    { key: 'youtube', label: 'YouTube', icon: 'smart_display', color: '#57534e', ph: t('profileTab.youtubePh') },
    { key: 'city', label: t('profileTab.city'), icon: 'location_on', color: '#57534e', ph: t('profileTab.cityPh') },
  ] as const;

  return (
    <>
      <main className="flex min-w-0 flex-col gap-[18px]">
        <section className={SECTION}>
          <div>
            <div className="text-xl font-extrabold">{t('profileTab.publicTitle')}</div>
            <div className="mt-[3px] text-sm text-stone-500">{t('profileTab.publicSub')}</div>
          </div>

          <div className="mt-[22px] flex flex-wrap items-center gap-[26px]">
            <div
              className="relative size-28 flex-none"
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
            >
              <div
                className={`grid size-28 place-items-center overflow-hidden rounded-full bg-[#2f4fa8] text-[34px] font-extrabold text-white ${dragOver ? 'ring-4 ring-[#fdba74]' : ''}`}
              >
                {form.avatarUrl ? <img src={resolveApiPath(form.avatarUrl)} alt={t('profileTab.avatarAlt')} className="size-full object-cover" /> : initialsOf(form.first, form.last)}
              </div>
              <button
                type="button"
                aria-label={t('profileTab.changeAvatar')}
                onClick={() => fileRef.current?.click()}
                className="absolute right-0 bottom-1 grid size-8 cursor-pointer place-items-center rounded-full border border-[#ece5df] bg-white p-0 shadow-[0_2px_6px_rgba(0,0,0,.1)]"
              >
                <MaterialIcon name="photo_camera" size={18} />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                hidden
                onChange={(e) => {
                  void pickAvatar(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </div>
            <div className="min-w-[240px] flex-1">
              <div className="flex flex-wrap items-center gap-[18px]">
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className={OUTLINE_BTN}>
                  <MaterialIcon name="account_circle" size={20} />
                  {uploading ? t('profileTab.uploading') : t('profileTab.changeAvatar')}
                </button>
                <button
                  type="button"
                  disabled={!form.avatarUrl}
                  onClick={() => void saveAvatar('').catch((err) => toast.error(err instanceof ApiError ? err.message : t('profileTab.removeFail')))}
                  className="flex items-center gap-1.5 border-0 bg-transparent p-0 text-sm font-semibold text-[#dc2626] disabled:opacity-40"
                >
                  <MaterialIcon name="delete" size={20} />
                  {t('profileTab.removePhoto')}
                </button>
              </div>
              <div className="mt-3 text-[13.5px] text-stone-500">
                {form.avatarUrl ? t('profileTab.dragHint') : t('profileTab.realPhotoHint')}
              </div>
            </div>
          </div>

          <div className="mt-[22px] grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
            <label className={LABEL}>
              {t('profileTab.lastName')}
              <IconInput icon="person">
                <input value={form.last} onChange={(e) => set('last', e.target.value)} maxLength={80} className={BARE_INPUT} />
              </IconInput>
            </label>
            <label className={LABEL}>
              {t('profileTab.firstName')}
              <IconInput icon="person">
                <input value={form.first} onChange={(e) => set('first', e.target.value)} maxLength={80} className={BARE_INPUT} />
              </IconInput>
            </label>
          </div>

          <div className="mt-[18px] text-[14.5px] font-bold">{t('profileTab.handleLabel')}</div>
          <div className="mt-2 flex h-[50px] overflow-hidden rounded-xl border-[1.5px] border-[#e7e0da] focus-within:border-[#fdba74]">
            <span className="flex flex-none items-center border-r-[1.5px] border-[#e7e0da] bg-[#f5f2ef] px-4 text-[15px] text-stone-600">sofinhub.com/@</span>
            <input
              value={form.handle}
              onChange={(e) => set('handle', sanitizeHandle(e.target.value))}
              aria-label={t('profileTab.handleLabel')}
              className="min-w-0 flex-1 border-0 px-3.5 text-[15px] font-medium outline-0"
            />
            {(form.handle || fmtErr) && (
              <span className={`flex flex-none items-center gap-1.5 px-3.5 text-[13px] font-semibold ${hOk && !hPending ? 'text-[#16a34a]' : hPending ? 'text-stone-500' : 'text-[#dc2626]'}`}>
                <MaterialIcon name={hPending ? 'sync' : hOk ? 'check_circle' : 'error'} size={22} filled />
                {hPending ? t('profileTab.checking') : hText}
              </span>
            )}
          </div>

          <div className="mt-[18px] text-[14.5px] font-bold">{t('profileTab.bio')}</div>
          <div className="mt-2 flex gap-3 rounded-xl border-[1.5px] border-[#e7e0da] p-3.5 focus-within:border-[#fdba74]">
            <span className="mt-0.5">
              <MaterialIcon name="edit" size={20} color="#78716c" />
            </span>
            <textarea
              value={form.bio}
              onChange={(e) => set('bio', e.target.value)}
              maxLength={BIO_MAX}
              placeholder={t('profileTab.bioPh')}
              aria-label={t('profileTab.bio')}
              className="h-[62px] min-w-0 flex-1 resize-none border-0 text-[15px] leading-[1.6] font-medium outline-0 placeholder:text-stone-400"
            />
          </div>
          <div className="mt-2 text-right text-[13px] text-stone-500">
            {form.bio.length}/{BIO_MAX}
          </div>
        </section>

        <section className={SECTION}>
          <div className="flex items-start gap-4">
            <span className="grid size-[46px] flex-none place-items-center rounded-full bg-[#fff1e6]">
              <MaterialIcon name="link" size={24} weight={600} color="#f26a1b" />
            </span>
            <div>
              <div className="text-xl font-extrabold">{t('profileTab.linksTitle')}</div>
              <div className="mt-[3px] text-sm text-stone-500">{t('profileTab.linksSub')}</div>
            </div>
          </div>
          <div className="mt-5 grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
            {links.map((l) => (
              <label key={l.key} className={LABEL}>
                {l.label}
                <IconInput icon={l.icon} iconColor={l.color} height={48}>
                  <input value={form[l.key]} onChange={(e) => set(l.key, e.target.value)} placeholder={l.ph} maxLength={300} className={BARE_INPUT} />
                </IconInput>
              </label>
            ))}
          </div>
          <div className="mt-[22px] flex items-center gap-4">
            <div className="flex-1">
              <div className="text-[15px] font-bold">{t('profileTab.showOnMap')}</div>
              <div className="mt-[3px] text-[13.5px] text-stone-500">{t('profileTab.showOnMapSub')}</div>
            </div>
            <Toggle on={form.showOnMap} onChange={(v) => set('showOnMap', v)} label={t('profileTab.showOnMapLabel')} />
          </div>
        </section>
      </main>

      <aside className="self-start rounded-[20px] border border-[rgba(120,60,20,.07)] bg-white p-[18px] min-[900px]:col-start-2 min-[900px]:row-start-2 min-[1240px]:sticky min-[1240px]:top-[88px] min-[1240px]:col-start-3 min-[1240px]:row-start-1">
        <div className="mb-3.5 text-[15px] font-bold">{t('profileTab.previewTitle')}</div>
        <ProfilePreview
          form={form}
          stats={{ level: stats.data?.level, points: stats.data?.totalPoints, communities: stats.data?.communityCount, joinedAt: user.createdAt }}
        />
        <div className="mt-4 grid grid-cols-[1fr_1.4fr] gap-3">
          <button type="button" onClick={cancel} disabled={update.isPending} className="h-[52px] rounded-xl border-[1.5px] border-[#e7e0da] bg-white text-[15px] font-bold disabled:opacity-50">
            {t('profileTab.cancel')}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={update.isPending}
            className={`${PRIMARY_BTN} h-[52px] text-[15.5px] ${dirty ? '' : 'opacity-85'}`}
          >
            {update.isPending ? t('profileTab.saving') : t('profileTab.save')}
          </button>
        </div>
      </aside>
    </>
  );
}
